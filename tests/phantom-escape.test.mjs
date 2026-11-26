import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRun, stepRun, TICKS_PER_SECOND } from '../src/demos/phantom-escape/engine.ts'
import { cellAt, centerOf, COLUMNS, distancesFrom, generateMaze, levelRules, ROWS } from '../src/demos/phantom-escape/map.ts'

const idle = { x: 0, y: 0 }

test('10,000 seeded mazes have reachable objectives, unique safe spawns, and solid borders', () => {
  for (let seed = 0; seed < 10_000; seed++) {
    const level = 1 + seed % 15
    const maze = generateMaze(seed, level)
    const distances = distancesFrom(maze.floor, maze.start)
    const spawns = [maze.start, maze.exit, ...maze.enemies, ...maze.coins]
    const rules = levelRules(level)

    assert.equal(maze.coins.length, rules.coins)
    assert.equal(maze.enemies.length, rules.enemies)
    assert.equal(new Set(spawns).size, spawns.length)
    assert.ok(spawns.every(cell => maze.floor[cell] && distances[cell] >= 0), `seed ${seed}`)
    assert.ok(maze.floor.every((tile, cell) => !tile || distances[cell] >= 0), `disconnected floor on seed ${seed}`)
    assert.ok(maze.enemies.every(cell => distances[cell] >= 12), `seed ${seed}`)
    for (let y = 0; y < ROWS; y++) {
      assert.equal(maze.floor[y * COLUMNS], 0)
      assert.equal(maze.floor[(y + 1) * COLUMNS - 1], 0)
    }
    assert.ok(maze.floor.slice(0, COLUMNS).every(cell => !cell))
    assert.ok(maze.floor.slice(-COLUMNS).every(cell => !cell))
  }
})

test('movement cannot clip a wall or cut between blocked diagonal neighbors', () => {
  const run = createRun(19)
  const { maze, player } = run.board
  run.board.enemies = []
  maze.floor.fill(0)
  maze.floor[maze.start] = 1
  maze.floor[maze.start + COLUMNS + 1] = 1
  for (let tick = 0; tick < 60; tick++) stepRun(run, { x: 1, y: 1 })
  assert.equal(cellAt(player.x, player.y), maze.start)
  assert.equal(maze.floor[cellAt(player.x + 5, player.y + 5)], 1)
  assert.equal(maze.floor[cellAt(player.x + 5, player.y - 5)], 1)
  assert.equal(maze.floor[cellAt(player.x - 5, player.y + 5)], 1)
})

test('replaying the same seed and inputs reproduces movement, scoring, chase alerts and death', () => {
  const directions = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }, idle,
  ]
  function replay() {
    const run = createRun(6)
    const events = []
    for (let tick = 0; tick < 1623; tick++) {
      const input = directions[Math.floor(tick / 29) * 7 % directions.length]
      for (const sound of stepRun(run, input)) events.push([tick + 1, sound])
    }
    return { run, events }
  }
  const first = replay()
  assert.deepEqual(replay(), first)
  assert.deepEqual(first.events, [
    [133, 'coin'], [249, 'coin'], [1502, 'alert_enemy_detect_player'],
    [1578, 'alert_enemy_detect_player'], [1623, 'death'],
  ])
  assert.equal(first.run.score, 200)
  assert.equal(first.run.ended, 'caught')
  assert.equal(cellAt(first.run.board.player.x, first.run.board.player.y), 426)
})

test('diagonal and cardinal movement cover the same distance on open floor', () => {
  const cardinal = createRun(42)
  const diagonal = createRun(42)
  const start = centerOf(cardinal.board.maze.start)
  for (const run of [cardinal, diagonal]) {
    run.board.enemies = []
    run.board.maze.floor.fill(1)
  }
  stepRun(cardinal, { x: 1, y: 0 })
  stepRun(diagonal, { x: 1, y: 1 })
  const distance = ({ x, y }) => Math.hypot(x - start.x, y - start.y)
  assert.ok(Math.abs(distance(cardinal.board.player) - distance(diagonal.board.player)) < 1e-10)
})

test('coins score once, the exit requires the quota, and a perfect clear grants a bonus', () => {
  for (const perfect of [false, true]) {
    const run = createRun(42)
    const board = run.board
    board.enemies = []
    board.player = centerOf(board.maze.exit)
    assert.deepEqual(stepRun(run, idle), [])
    assert.equal(run.level, 1)
    const target = perfect ? board.coins.size : board.quota
    for (const [index, cell] of [...board.coins].slice(0, target).entries()) {
      board.player = centerOf(cell)
      assert.deepEqual(stepRun(run, idle), index + 1 === board.quota ? ['coin', 'unlock_exit'] : ['coin'])
      assert.deepEqual(stepRun(run, idle), [])
    }
    assert.equal(run.score, target * 100)
    board.player = centerOf(board.maze.exit)
    assert.deepEqual(stepRun(run, idle), [perfect ? 'level_clear_perfect' : 'level_clear'])
    assert.equal(run.level, 2)
    assert.equal(run.score, target * 100 + 500 + (perfect ? 200 : 0))
    assert.deepEqual(run.board.maze, generateMaze(42, 2))
    assert.equal(run.board.ticksLeft, 65 * TICKS_PER_SECOND)
  }
})

test('one hit ends the run, a timed-out board stops advancing, and restart clears state', () => {
  const run = createRun(19)
  const chaser = run.board.enemies.find(enemy => enemy.kind === 'chaser')
  run.board.enemies = [chaser]
  run.board.player = centerOf(chaser.cell)
  assert.deepEqual(stepRun(run, idle), ['death'])
  assert.equal(run.ended, 'caught')
  assert.equal(run.score, 0)

  const retry = createRun(run.seed)
  assert.deepEqual(retry.board.maze, run.board.maze)
  assert.deepEqual(retry.board.player, centerOf(retry.board.maze.start))
  assert.equal(retry.ended, null)
  assert.equal(retry.score, 0)
  assert.equal(retry.level, 1)

  retry.board.enemies = []
  retry.board.ticksLeft = 10 * TICKS_PER_SECOND + 1
  assert.deepEqual(stepRun(retry, idle), ['warning_countdown_begin'])
  for (let tick = 0; tick < TICKS_PER_SECOND - 1; tick++) stepRun(retry, idle)
  assert.deepEqual(stepRun(retry, idle), ['warning_countdown'])
  retry.board.ticksLeft = 1
  assert.deepEqual(stepRun(retry, idle), ['death'])
  assert.equal(retry.ended, 'timeout')
  const snapshot = structuredClone(retry)
  assert.deepEqual(stepRun(retry, { x: 1, y: 1 }), [])
  assert.deepEqual(retry, snapshot)
})
