import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createRun, stepRun } from '../src/demos/phantom-escape/engine.ts'
import { createLearnedController, readLearnedActor } from '../src/demos/phantom-escape/learned.ts'
import { TICKS_PER_ACTION } from '../src/demos/phantom-escape/observations.ts'

const actor = readLearnedActor(JSON.parse(readFileSync(
  new URL('../src/demos/phantom-escape/learned-weights.json', import.meta.url), 'utf8',
)))

test('the deployed State PPO actor follows the seeded reference action trace', () => {
  const run = createRun(5300)
  const controller = createLearnedController('state', actor)
  for (const expected of [1, 7, 8, 7, 5, 6, 7, 7, 7, 7, 7, 7]) {
    for (let tick = 0; tick < TICKS_PER_ACTION; tick++) {
      const move = controller.movement(run)
      assert.equal(controller.action, expected)
      stepRun(run, move)
    }
  }
  assert.equal(controller.frame, undefined)
})

test('Spatial Vision samples RGB and holds each action between decisions', () => {
  const run = createRun(5301)
  const controller = createLearnedController('vision', actor)
  const action = controller.movement(run)
  const firstFrame = controller.frame
  assert.equal(firstFrame.length, 320 * 192 * 3)
  stepRun(run, action)
  for (let tick = 1; tick < TICKS_PER_ACTION; tick++) {
    assert.equal(controller.movement(run), action)
    assert.equal(controller.frame, firstFrame)
    stepRun(run, action)
  }
  controller.movement(run)
  assert.notEqual(controller.frame, firstFrame)
})
