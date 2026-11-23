import { readVision } from './runner.ts'
import model from './model.json' with { type: 'json' }

export const JUMP_THRESHOLD = model.threshold

export function predictJump(current: Uint8Array, previous: Uint8Array) {
  const { gap, speed } = readVision(current, previous)
  if (gap === null || speed === null) return { gap, speed, probability: null }
  const [bias, gapWeight, speedWeight] = model.weights
  const logit = bias + gap * gapWeight + speed * speedWeight
  return { gap, speed, probability: 1 / (1 + Math.exp(-logit)) }
}
