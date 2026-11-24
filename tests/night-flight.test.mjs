import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FRAME_SIZE, SAMPLE_TICKS } from '../src/demos/night-flight/frames.ts'
import { createPilot } from '../src/demos/night-flight/pilot.ts'
import { PixelClass } from '../src/demos/night-flight/vision.ts'
import { BIRD_X, createFlight, flap, PIPE_CAP_WIDTH, stepFlight } from '../src/demos/night-flight/flight.ts'

test('a flap lifts the bird and gravity brings it back down', () => {
  const flight = createFlight()
  const startY = flight.y
  flap(flight)
  stepFlight(flight)
  assert.ok(flight.y < startY)

  for (let tick = 0; tick < 40; tick++) stepFlight(flight)
  assert.ok(flight.y > startY)
  assert.equal(flight.crashed, false)

  while (!flight.crashed) stepFlight(flight)
  const crashTick = flight.ticks
  stepFlight(flight)
  assert.equal(flight.ticks, crashTick)
})

test('a pipe scores once after the bird clears its trailing edge', () => {
  const flight = createFlight()
  const [pipe] = flight.pipes
  pipe.x = BIRD_X - 10 - PIPE_CAP_WIDTH + 3
  flight.y = pipe.center

  stepFlight(flight)
  assert.equal(flight.score, 0)
  stepFlight(flight)
  assert.equal(flight.score, 1)
  stepFlight(flight)
  assert.equal(flight.score, 1)
  assert.equal(flight.crashed, false)
})

test('pipe caps collide beyond the shaft, but passing the gap is safe', () => {
  const flight = createFlight()
  const [pipe] = flight.pipes
  pipe.x = BIRD_X + 10 + 1
  flight.y = pipe.center - pipe.gap / 2 + 4
  stepFlight(flight)
  assert.equal(flight.crashed, true)

  const clearFlight = createFlight()
  clearFlight.pipes[0].x = pipe.x
  clearFlight.y = pipe.center
  stepFlight(clearFlight)
  assert.equal(clearFlight.crashed, false)
})

test('the CNN pilot exposes a class for each pixel of its current input', () => {
  const { classMap, frames } = createPilot().sample(createFlight())
  assert.equal(classMap.length, FRAME_SIZE ** 2)
  assert.deepEqual([...new Set(classMap)].sort(), Object.values(PixelClass))

  for (const [index, luminance] of frames[0].entries()) {
    if (luminance < 128) assert.equal(classMap[index], PixelClass.Background)
    if (luminance === 245) assert.equal(classMap[index], PixelClass.Bird)
    if (luminance === 186) assert.equal(classMap[index], PixelClass.PipeCap)
  }
})

test('the CNN pilot clears 70 pipe pairs on three seeded courses', () => {
  for (const seed of [1, 7, 13]) {
    let state = seed
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 2 ** 32
    }
    const flight = createFlight()
    const pilot = createPilot()

    while (!flight.crashed && flight.score < 70 && flight.ticks < 4200) {
      if (flight.ticks % SAMPLE_TICKS === 0 && pilot.sample(flight).flap) {
        pilot.recordFlap(flight.ticks)
        flap(flight)
      }
      stepFlight(flight, random)
    }

    assert.equal(flight.score, 70, `seed ${seed}`)
  }
})
