import assert from 'node:assert/strict'
import { test } from 'node:test'
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
