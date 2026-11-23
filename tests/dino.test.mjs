import test from 'node:test'
import assert from 'node:assert/strict'
import { CACTUS_FORMATIONS } from '../src/demos/dino/cacti.ts'
import {
  createRunner, crossedScoreMilestone, DINO_FRONT, drawObservation, FRAME_HEIGHT, FRAME_WIDTH, GROUND, jump,
  SAMPLE_TICKS, stepRunner,
} from '../src/demos/dino/runner.ts'
import { JUMP_THRESHOLD, predictJump } from '../src/demos/dino/vision.ts'

function observation() {
  return new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT)
}

test('vision tracks movement across rendered frames and changes its prediction as the gap closes', () => {
  const previous = observation()
  const current = observation()
  const obstacle = { x: DINO_FRONT + 22, shape: CACTUS_FORMATIONS.at(-1) }
  drawObservation(previous, 0, [obstacle])
  drawObservation(current, 0, [{ ...obstacle, x: obstacle.x - 4 }])
  const far = predictJump(current, previous)
  assert.equal(far.gap, 18)
  assert.equal(far.speed, 1)
  assert.ok(far.probability < JUMP_THRESHOLD)

  obstacle.x = DINO_FRONT + 11
  drawObservation(previous, 0, [obstacle])
  drawObservation(current, 0, [{ ...obstacle, x: obstacle.x - 4 }])
  const near = predictJump(current, previous)
  assert.equal(near.gap, 7)
  assert.ok(near.probability >= JUMP_THRESHOLD)

  drawObservation(current, 0, [])
  assert.deepEqual(predictJump(current, previous), { gap: null, speed: null, probability: null })
})

test('trained policy clears randomized obstacles at starting and top speed', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 8; seed++) {
    let state = seed
    const random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0
      return state / 2 ** 32
    }
    const run = createRunner()
    const current = observation()
    const previous = observation()
    drawObservation(current, run.rise, run.obstacles)
    let jumps = 0

    while (!run.crashed && run.ticks < 9000) {
      stepRunner(run, random)
      if (run.ticks % SAMPLE_TICKS !== 0) continue
      previous.set(current)
      drawObservation(current, run.rise, run.obstacles, run.distance)
      const { probability } = predictJump(current, previous)
      if (probability !== null && probability >= JUMP_THRESHOLD && jump(run)) {
        seen.add(run.obstacles.find(obstacle => obstacle.x >= DINO_FRONT)?.shape)
        jumps++
      }
    }

    assert.equal(run.crashed, false, `Collision on seed ${seed} at tick ${run.ticks}`)
    assert.equal(run.speed, 1.45)
    assert.ok(jumps > 100)
  }
  assert.ok(CACTUS_FORMATIONS.every(shape => seen.has(shape)))
})

test('point sounds trigger once when crossing each thousand-point boundary', () => {
  assert.equal(crossedScoreMilestone(0, .85), false)
  assert.equal(crossedScoreMilestone(999.7, 1000), true)
  assert.equal(crossedScoreMilestone(1000, 1001.45), false)
  assert.equal(crossedScoreMilestone(1999.8, 2001.25), true)
  assert.equal(crossedScoreMilestone(2001.25, 0), false)
  assert.equal(crossedScoreMilestone(999.6, 1001), true)
})

test('grounded frames alternate leg positions while the airborne pose stays fixed', () => {
  const back = observation()
  const front = observation()
  drawObservation(back, 0, [], 1)
  drawObservation(front, 0, [], 7)
  const legsStart = (GROUND - 2) * FRAME_WIDTH
  assert.deepEqual(back.slice(0, legsStart), front.slice(0, legsStart))
  assert.notDeepEqual(back.slice(legsStart), front.slice(legsStart))

  drawObservation(back, 4, [], 1)
  drawObservation(front, 4, [], 7)
  assert.deepEqual(back, front)
})
