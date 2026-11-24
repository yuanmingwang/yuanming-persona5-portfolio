export const WIDTH = 360
export const HEIGHT = 216
export const GROUND = 194
export const BIRD_X = 84
export const PIPE_CAP_WIDTH = 34
export const PIPE_CAP_HEIGHT = 7
export const PIPE_INSET = 3
export const TICKS_PER_SECOND = 60

const PIPE_SPACING = 152
export const GRAVITY = .23
export const MAX_FALL_SPEED = 6
export const FLAP_SPEED = -4.1
export const BIRD_HALF_WIDTH = 10
export const BIRD_HALF_HEIGHT = 8

type Pipe = { x: number; center: number; gap: number; passed: boolean }

export type Flight = {
  y: number
  velocity: number
  pipes: Pipe[]
  distance: number
  ticks: number
  score: number
  crashed: boolean
}

export function createFlight(): Flight {
  return {
    y: 92,
    velocity: 0,
    pipes: [{ x: 278, center: 101, gap: 76, passed: false }],
    distance: 0,
    ticks: 0,
    score: 0,
    crashed: false,
  }
}

export function flap(flight: Flight) {
  flight.velocity = FLAP_SPEED
}

export function advanceBird(bird: { y: number; velocity: number }) {
  bird.velocity = Math.min(bird.velocity + GRAVITY, MAX_FALL_SPEED)
  bird.y += bird.velocity
}

export function scrollSpeed(score: number) {
  return Math.min(3.2, 1.85 + score * .045)
}

export function stepFlight(flight: Flight, random = Math.random) {
  if (flight.crashed) return

  const speed = scrollSpeed(flight.score)
  flight.ticks++
  flight.distance += speed
  advanceBird(flight)

  const top = flight.y - BIRD_HALF_HEIGHT
  const bottom = flight.y + BIRD_HALF_HEIGHT
  const left = BIRD_X - BIRD_HALF_WIDTH
  const right = BIRD_X + BIRD_HALF_WIDTH
  flight.crashed = top <= 0 || bottom >= GROUND

  for (const pipe of flight.pipes) {
    pipe.x -= speed
    const trailingEdge = pipe.x + PIPE_CAP_WIDTH
    const gapTop = pipe.center - pipe.gap / 2
    const gapBottom = pipe.center + pipe.gap / 2
    const overlapsCap = right > pipe.x && left < trailingEdge
    const overlapsShaft = right > pipe.x + PIPE_INSET && left < trailingEdge - PIPE_INSET
    const hitsCap = overlapsCap && (
      (top < gapTop && bottom > gapTop - PIPE_CAP_HEIGHT) ||
      (bottom > gapBottom && top < gapBottom + PIPE_CAP_HEIGHT)
    )
    if (hitsCap || (overlapsShaft && (top < gapTop || bottom > gapBottom))) flight.crashed = true
    if (!flight.crashed && !pipe.passed && left >= trailingEdge) {
      pipe.passed = true
      flight.score++
    }
  }

  if (flight.crashed) return
  // Spawn the next pair before the first can leave the screen.
  if (flight.pipes[0].x + PIPE_CAP_WIDTH <= 0) flight.pipes.shift()
  const last = flight.pipes[flight.pipes.length - 1]
  const spawnX = last.x + PIPE_SPACING
  if (spawnX <= WIDTH + PIPE_CAP_WIDTH) {
    flight.pipes.push({
      x: spawnX,
      center: Math.round(Math.max(58, Math.min(137, last.center + (random() - .5) * 84))),
      gap: Math.max(59, 76 - flight.score * .5),
      passed: false,
    })
  }
}
