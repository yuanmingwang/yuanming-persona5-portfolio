import {
  advanceBird, BIRD_HALF_HEIGHT, BIRD_HALF_WIDTH, BIRD_X, FLAP_SPEED, GROUND, HEIGHT, PIPE_CAP_WIDTH,
} from './flight.ts'
import { SAMPLE_TICKS } from './frames.ts'
import type { PipeReading } from './vision.ts'

type Candidate = { y: number; velocity: number; cost: number; flap: boolean }

const LOOKAHEAD_STEPS = 28
const BEAM_WIDTH = 64
const BIRD_LEFT = BIRD_X - BIRD_HALF_WIDTH
const BIRD_RIGHT = BIRD_X + BIRD_HALF_WIDTH

export function planFlap(y: number, velocity: number, pipes: readonly PipeReading[], speed: number) {
  // Compare flap and glide every sample, simulating collisions at physics tick resolution.
  let queue: Candidate[] = [{ y, velocity, cost: 0, flap: false }]
  for (let step = 0; step < LOOKAHEAD_STEPS; step++) {
    const firstTick = step * SAMPLE_TICKS + 1
    // Leave room for the position error introduced by downsampling the image.
    const constraints = Array.from({ length: SAMPLE_TICKS }, (_, index) => {
      const elapsed = firstTick + index
      const pipeIndex = pipes.findIndex(pipe => pipe.x + PIPE_CAP_WIDTH - speed * elapsed > BIRD_LEFT - 4)
      const pipe = pipes[pipeIndex]
      const pipeX = pipe ? pipe.x - speed * elapsed : Infinity
      const overlapping = pipeX < BIRD_RIGHT + 4
      const next = pipes[pipeIndex + 1]
      const center = pipe?.center ?? HEIGHT / 2
      const exitDistance = pipeX + PIPE_CAP_WIDTH - BIRD_LEFT
      const lead = overlapping && next ? Math.max(0, 1 - exitDistance / 32) * .24 : 0
      return {
        target: center + (next ? (next.center - center) * lead : 0),
        center,
        halfGap: overlapping ? pipe.gap / 2 - BIRD_HALF_HEIGHT : Infinity,
      }
    })
    const candidates: Candidate[] = []
    for (const state of queue) {
      for (const flap of [false, true]) {
        const next = {
          y: state.y,
          velocity: flap ? FLAP_SPEED : state.velocity,
          cost: state.cost + (flap ? .5 : 0),
          flap: step === 0 ? flap : state.flap,
        }
        for (const { target, center, halfGap } of constraints) {
          advanceBird(next)
          const outside = Math.max(0, BIRD_HALF_HEIGHT + 3 - next.y, next.y - (GROUND - BIRD_HALF_HEIGHT - 3))
          const clearance = halfGap - Math.abs(next.y - center)
          next.cost += (next.y - target) ** 2 * .002 + outside * 250
          next.cost += Math.max(0, 6 - clearance) ** 2 * 1.2
          if (clearance < 2) next.cost += (2 - clearance) * (250 - step * 5)
        }
        candidates.push(next)
      }
    }
    candidates.sort((a, b) => a.cost - b.cost)
    // Keep the best candidate in each position/velocity bin to preserve alternative paths.
    const seen = new Set<number>()
    queue = []
    for (const candidate of candidates) {
      const cell = Math.round(candidate.y / 2) * 32 + Math.round(candidate.velocity * 2)
      if (seen.has(cell)) continue
      seen.add(cell)
      queue.push(candidate)
      if (queue.length === BEAM_WIDTH) break
    }
  }
  return queue[0].flap
}

