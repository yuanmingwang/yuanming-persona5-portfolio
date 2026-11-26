import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createRun, stepRun } from '../src/demos/phantom-escape/engine.ts'
import { createLearnedController, readLearnedActor } from '../src/demos/phantom-escape/learned.ts'
import { TICKS_PER_ACTION } from '../src/demos/phantom-escape/observations.ts'
import { createVisionRecovery } from '../src/demos/phantom-escape/vision-recovery.ts'
import { observeSceneMoves, readVisionScene } from '../src/demos/phantom-escape/vision-spatial.ts'
import { createVisionPainter } from '../src/demos/phantom-escape/vision.ts'

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
  const decision = controller.decision
  assert.equal(decision.action, controller.action)
  assert.equal(decision.alternatives[0].action, decision.action)
  assert.ok(decision.alternatives.every(({ probability }) => probability >= 0 && probability <= 1))
  const firstFrame = controller.frame
  assert.equal(firstFrame.length, 320 * 192 * 3)
  stepRun(run, action)
  for (let tick = 1; tick < TICKS_PER_ACTION; tick++) {
    assert.equal(controller.movement(run), action)
    assert.equal(controller.frame, firstFrame)
    assert.equal(controller.decision, decision)
    stepRun(run, action)
  }
  controller.movement(run)
  assert.notEqual(controller.frame, firstFrame)
})

test('Spatial Vision breaks the corridor loop on seed 5410 and reaches the next level', () => {
  const run = createRun(5410)
  const controller = createLearnedController('vision', actor)
  let recovered = false
  while (!run.ended && run.level === 1) {
    const action = controller.movement(run)
    recovered ||= controller.decision.recovering
    stepRun(run, action)
  }
  assert.equal(recovered, true)
  assert.equal(run.level, 2)
})

test('vision recovery drops its history when it sees a new level', () => {
  const scene = readVisionScene(createVisionPainter()(createRun(5301).board))
  const recovery = createVisionRecovery()
  const moves = observeSceneMoves(scene, false)
  const hud = [1, .5, .3, 0, 0]
  for (let sample = 0; sample < 25; sample++) assert.equal(recovery(scene, moves, hud, 0), 0)
  assert.notEqual(recovery(scene, moves, hud, 0), 0)
  assert.equal(recovery(scene, moves, [1, 2 / 3, .3, 0, 0], 0), 0)
})
