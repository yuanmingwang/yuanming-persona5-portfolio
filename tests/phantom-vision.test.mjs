import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRun } from '../src/demos/phantom-escape/engine.ts'
import { centerOf } from '../src/demos/phantom-escape/map.ts'
import { createVisionPainter, VISION_HEIGHT, VISION_WIDTH } from '../src/demos/phantom-escape/vision.ts'

test('the vision renderer draws deterministic RGB with sub-tile movement and exit state', () => {
  const run = createRun(5300)
  const paint = createVisionPainter()
  const initial = paint(run.board)
  assert.equal(initial.length, 320 * 192 * 3)
  assert.equal(VISION_HEIGHT, 192)
  assert.deepEqual(paint(run.board), initial)
  const offset = (point) => (Math.round(point.y / 2) * VISION_WIDTH + Math.round(point.x / 2)) * 3
  const exit = offset(centerOf(run.board.maze.exit))
  assert.deepEqual([...initial.slice(exit, exit + 3)], [250, 65, 115])
  for (const coin of [...run.board.coins].slice(0, run.board.quota)) run.board.coins.delete(coin)
  const unlocked = paint(run.board)
  assert.deepEqual([...unlocked.slice(exit, exit + 3)], [65, 245, 161])
  run.board.player.x += 2
  assert.notDeepEqual(paint(run.board), unlocked)
})
