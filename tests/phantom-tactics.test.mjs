import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRun, stepRun } from '../src/demos/phantom-escape/engine.ts'
import { COLUMNS, generateMaze, levelRules } from '../src/demos/phantom-escape/map.ts'
import { findRoute } from '../src/demos/phantom-escape/path.ts'
import { createTacticalPlayer } from '../src/demos/phantom-escape/tactics.ts'

test('new map families enter the seeded rotation one at a time', () => {
  assert.deepEqual(levelRules(1).mapPool, ['rooms', 'arena'])
  assert.deepEqual(levelRules(3).mapPool, ['rooms', 'arena'])
  assert.deepEqual(levelRules(4).mapPool, ['rooms', 'arena', 'hybrid'])
  assert.deepEqual(levelRules(6).mapPool, ['rooms', 'arena', 'hybrid'])
  assert.deepEqual(levelRules(7).mapPool, ['rooms', 'arena', 'hybrid', 'labyrinth'])
  for (const level of [1, 2, 4, 7, 10]) {
    const families = new Set(Array.from({ length: 32 }, (_, seed) => generateMaze(seed, level).family))
    assert.deepEqual([...families].sort(), [...levelRules(level).mapPool].sort())
  }
  for (const seed of [6, 19, 42]) {
    assert.notEqual(generateMaze(seed, 1).family, generateMaze(seed, 2).family)
    assert.deepEqual(generateMaze(seed, 7), generateMaze(seed, 7))
  }
})

test('A* detours around danger and only uses cardinal floor cells', () => {
  const floor = new Uint8Array(COLUMNS * 5)
  const risk = new Float32Array(floor.length)
  const explored = new Set()
  const start = 2 * COLUMNS + 1
  const goal = start + 4
  for (let offset = 0; offset <= 4; offset++) floor[start + offset] = floor[start + offset - COLUMNS] = 1
  risk[start + 2] = 10

  const route = findRoute(floor, start, goal, risk, explored)
  assert.equal(route.cost, 6)
  assert.equal(route.cells[0], start)
  assert.equal(route.cells.at(-1), goal)
  assert.ok(!route.cells.includes(start + 2))
  for (const [index, cell] of route.cells.entries()) {
    assert.ok(explored.has(cell) && floor[cell])
    if (!index) continue
    const step = Math.abs(cell - route.cells[index - 1])
    assert.ok(step === 1 || step === COLUMNS)
  }
})

test('the tactical controller clears at least 95 of 100 early seeds for each starting family', () => {
  const results = { rooms: 0, arena: 0 }
  const fails = []
  for (let seed = 5300; seed < 5500; seed++) {
    const run = createRun(seed)
    const controller = createTacticalPlayer()
    const family = run.board.maze.family
    while (run.level === 1 && !run.ended) stepRun(run, controller.movement(run))
    if (run.level === 2) {
      results[family]++
      controller.movement(run)
      assert.equal(controller.plan.floor, run.board.maze.floor)
      assert.equal(controller.plan.intent, 'Collect')
    } else {
      fails.push([seed, family, run.ended])
    }
  }
  assert.ok(results.rooms >= 95 && results.arena >= 95, JSON.stringify({ results, fails }))
})
