import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRun } from '../src/demos/phantom-escape/engine.ts'
import { advance, spec } from '../scripts/phantom_escape/simulation.ts'
import { createTeacher } from '../scripts/phantom_escape/teacher.ts'

test('the teacher clears an arena and a dungeon with the training action cadence', () => {
  for (const seed of [5300, 5301]) {
    const run = createRun(seed)
    const teacher = createTeacher()
    for (let step = 0; step < 600 && run.level === 1 && !run.ended; step++) {
      const action = teacher(run)
      assert.ok(Number.isInteger(action) && action >= 0 && action < spec.actionCount)
      advance(run, action)
    }
    assert.equal(run.level, 2)
  }
})
