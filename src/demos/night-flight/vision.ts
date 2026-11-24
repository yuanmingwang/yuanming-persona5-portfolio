import {
  BIRD_HALF_WIDTH, BIRD_X, FLAP_SPEED, GRAVITY, HEIGHT, MAX_FALL_SPEED,
  PIPE_CAP_HEIGHT, PIPE_CAP_WIDTH, WIDTH,
} from './flight.ts'
import { FRAME_SIZE, SAMPLE_TICKS } from './frames.ts'
import { planFlap } from './planner.ts'
import model from './model.json' with { type: 'json' }

const X_SCALE = WIDTH / FRAME_SIZE
const Y_SCALE = HEIGHT / FRAME_SIZE

export type PipeReading = { x: number; center: number; gap: number }
export type VisionWeights = typeof model

type Reading = { birdY: number | null; pipes: PipeReading[] }

export function readFrame(frame: Uint8Array, weights: VisionWeights = model): Reading {
  const stride = FRAME_SIZE + 2
  const input = new Float32Array(stride ** 2)
  for (let y = 0; y < FRAME_SIZE; y++) {
    for (let x = 0; x < FRAME_SIZE; x++) {
      input[(y + 1) * stride + x + 1] = frame[y * FRAME_SIZE + x] / 255
    }
  }

  let birdTop = FRAME_SIZE
  let birdBottom = -1
  const capTops = new Int16Array(FRAME_SIZE).fill(FRAME_SIZE)
  const capBottoms = new Int16Array(FRAME_SIZE).fill(-1)
  const logits = new Float32Array(3)
  for (let y = 0; y < FRAME_SIZE; y++) {
    for (let x = 0; x < FRAME_SIZE; x++) {
      // The sprite and cap markings are brighter than 0.5 in this palette.
      if (input[(y + 1) * stride + x + 1] < .5) continue
      logits.set(weights.outputBias)
      for (let filter = 0; filter < weights.kernels.length; filter++) {
        const kernel = weights.kernels[filter]
        let value = weights.bias[filter]
        for (let row = 0; row < 3; row++) {
          const offset = (y + row) * stride + x
          value += input[offset] * kernel[row * 3]
            + input[offset + 1] * kernel[row * 3 + 1]
            + input[offset + 2] * kernel[row * 3 + 2]
        }
        const activation = Math.max(0, value)
        for (let category = 0; category < logits.length; category++) {
          logits[category] += weights.head[category][filter] * activation
        }
      }
      if (logits[1] > logits[0] && logits[1] > logits[2]) {
        birdTop = Math.min(birdTop, y)
        birdBottom = Math.max(birdBottom, y)
      } else if (logits[2] > logits[0]) {
        capTops[x] = Math.min(capTops[x], y)
        capBottoms[x] = Math.max(capBottoms[x], y)
      }
    }
  }

  const pipes: PipeReading[] = []
  for (let x = 0; x < FRAME_SIZE; x++) {
    if (capBottoms[x] - capTops[x] < 20) continue
    const first = x
    while (x + 1 < FRAME_SIZE && capBottoms[x + 1] - capTops[x + 1] >= 20) x++
    const center = (capTops[first] + capBottoms[first] + 1) * Y_SCALE / 2 + (PIPE_CAP_HEIGHT - 2) / 2
    const gap = (capBottoms[first] - capTops[first]) * Y_SCALE - PIPE_CAP_HEIGHT
    pipes.push({ x: (first + x + 1) * X_SCALE / 2 - 7, center, gap })
  }
  return { birdY: birdBottom < 0 ? null : (birdTop + birdBottom + 1) * Y_SCALE / 2 + 1, pipes }
}

export function decideFlight(history: readonly Reading[], ticksSinceFlap: number | null, speed: number) {
  const [current, previous, penultimate] = history
  const birdY = current?.birdY ?? null
  if (birdY === null) return { flap: false, birdY, velocity: null, gapY: null }

  const lastY = previous?.birdY
  const priorY = penultimate?.birdY
  const recentVelocity = lastY == null ? 0 : (birdY - lastY) / SAMPLE_TICKS
  const priorVelocity = lastY == null || priorY == null ? null : (lastY - priorY) / SAMPLE_TICKS
  const acceleratingNormally = priorVelocity !== null && Math.abs(recentVelocity - priorVelocity - GRAVITY * SAMPLE_TICKS) < 1
  const observedVelocity = lastY == null ? 0 : acceleratingNormally && priorY != null
    ? (birdY - priorY) / (2 * SAMPLE_TICKS) + GRAVITY * 2.5
    : recentVelocity + GRAVITY

  const velocity = ticksSinceFlap === null ? observedVelocity : Math.min(MAX_FALL_SPEED, FLAP_SPEED + ticksSinceFlap * GRAVITY)
  const pipes = current.pipes.filter(pipe => pipe.x + PIPE_CAP_WIDTH > BIRD_X - BIRD_HALF_WIDTH - 4)
  const nextPipe = pipes[0]
  return {
    flap: planFlap(birdY, velocity, pipes, speed),
    birdY,
    velocity,
    gapY: nextPipe?.center ?? null,
  }
}
