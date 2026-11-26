import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRun, stepRun } from '../src/demos/phantom-escape/engine.ts'
import { centerOf } from '../src/demos/phantom-escape/map.ts'
import { advance, observe, spec } from '../scripts/phantom_escape/simulation.ts'

test('training actions replay the same six arcade ticks, including early termination', () => {
  const trained = createRun(7)
  const arcade = createRun(7)
  const compass = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
    { x: -1, y: 0 }, { x: -1, y: -1 }]
  const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 0]
  for (let step = 0; !arcade.ended && step < 600; step++) {
    const action = sequence[Math.floor(step / 5) * 7 % sequence.length]
    const result = advance(trained, action)
    const events = []
    let ticks = 0
    while (!arcade.ended && ticks < 6) {
      events.push(...stepRun(arcade, compass[action]))
      ticks++
    }
    assert.equal(result.ticks, ticks)
    assert.deepEqual(result.events, events)
    assert.deepEqual(trained, arcade)
  }
  assert.equal(trained.ended, 'caught')
  assert.equal(trained.board.ticksLeft, 2876)
  assert.throws(() => advance(trained, 0), /Reset/)
})

test('reward tracks quota and level changes and observation switches to the new map', () => {
  const run = createRun(42)
  run.board.enemies = []
  const { grid, hud } = observe(run)
  const cells = spec.gridShape[1] * spec.gridShape[2]
  assert.deepEqual(spec.gridShape, [7, 24, 40])
  assert.equal(grid[3 * cells + run.board.maze.start], 1)
  assert.equal(grid[4 * cells + run.board.maze.exit], 1)
  assert.deepEqual(hud, [60 / 90, .5, .3, 0, 0])

  for (const [index, cell] of [...run.board.coins].slice(0, run.board.quota).entries()) {
    run.board.player = centerOf(cell)
    const result = advance(run, 0)
    assert.equal(result.reward, index + 1 === run.board.quota ? 2.995 : .995)
  }
  assert.equal(observe(run).hud[4], 1)

  run.board.player = centerOf(run.board.maze.exit)
  const clear = advance(run, 0)
  assert.equal(clear.reward, 9.995)
  assert.equal(run.level, 2)
  assert.equal(run.board.ticksLeft, 65 * 60 - 5)
  assert.equal(observe(run).grid[4 * cells + run.board.maze.exit], 1)
  assert.equal(observe(run).hud[4], 0)
  assert.throws(() => advance(run, 20), /Invalid/)
})

test('a blocked action incurs a penalty and terminal actions are only charged for ticks used', () => {
  const run = createRun(0)
  run.board.enemies = []
  run.board.maze.floor.fill(0)
  run.board.maze.floor[run.board.maze.start] = 1
  advance(run, 1)
  assert.equal(advance(run, 1).reward, -.025)
  run.board.ticksLeft = 1
  const result = advance(run, 0)
  assert.equal(result.ticks, 1)
  assert.equal(run.ended, 'timeout')
  assert.equal(result.reward, -5 - .005 / 6)
})
