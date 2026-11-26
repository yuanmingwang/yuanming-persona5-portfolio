import { HIT_DISTANCE, PLAYER_STEP } from './engine.ts'
import type { PhantomRun } from './engine.ts'
import { createMoveObservation, MOVE_FIELDS } from './forecast.ts'
import { levelRules } from './map.ts'
import { ACTIONS, observeHud, TICKS_PER_ACTION } from './observations.ts'
import { observeSceneMoves, readVisionScene } from './vision-spatial.ts'
import { createVisionRecovery } from './vision-recovery.ts'
import { createVisionPainter } from './vision.ts'

export type LearnedMode = 'state' | 'vision'
export const ACTION_LABELS = ['Wait', 'Up', 'Up-right', 'Right', 'Down-right', 'Down', 'Down-left', 'Left', 'Up-left']

export type LearnedDecision = {
  action: number
  alternatives: { action: number; probability: number }[]
  duration: number
  recovering: boolean
  avoidingEnemy: boolean
}

const LAYERS = [ACTIONS.length * MOVE_FIELDS + 5, 96, 64, ACTIONS.length]

function avoidCollision(action: number, clearance: readonly number[], logits: Float32Array) {
  if (!(clearance[action] <= HIT_DISTANCE)) return action
  // Prefer the model's best safe action. If all actions are risky, maximize clearance.
  return clearance.reduce((best, distance, candidate) => {
    if (distance > HIT_DISTANCE) {
      return clearance[best] <= HIT_DISTANCE || logits[candidate] > logits[best] ? candidate : best
    }
    return clearance[best] <= HIT_DISTANCE && distance > clearance[best] ? candidate : best
  }, action)
}

export function readLearnedActor(asset: { version: number; float32: string }) {
  if (asset.version !== 1) throw new Error('Unsupported Phantom Escape model format')
  const binary = atob(asset.float32)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  let offset = 0
  function take(count: number) {
    const weights = new Float32Array(count)
    for (let index = 0; index < count; index++, offset += 4) {
      weights[index] = view.getFloat32(offset, true)
      if (!Number.isFinite(weights[index])) throw new Error('Invalid model weight')
    }
    return weights
  }
  const center = take(LAYERS[0])
  const scale = take(LAYERS[0])
  if (scale.some(value => value <= 0)) throw new Error('Invalid model normalization')
  const layers = LAYERS.slice(1).map((outputs, index) => ({
    weights: take(outputs * LAYERS[index]),
    bias: take(outputs),
  }))
  if (offset !== bytes.length) throw new Error('Unexpected model data')

  return (input: readonly number[]) => {
    let activations = center.map((mean, index) =>
      Math.fround(Math.fround(Math.fround(input[index]) - mean) / scale[index]))
    for (const [index, { weights, bias }] of layers.entries()) {
      const previous = activations
      activations = bias.map((value, row) => {
        let sum = value
        const start = row * previous.length
        for (let col = 0; col < previous.length; col++) sum += weights[start + col] * previous[col]
        return index === layers.length - 1 ? sum : Math.tanh(sum)
      })
    }
    return activations
  }
}

export function createLearnedController(mode: LearnedMode, actor: ReturnType<typeof readLearnedActor>) {
  const observeState = createMoveObservation()
  const paintVision = createVisionPainter()
  const recover = createVisionRecovery()
  let untilNext = 0
  let action = 0
  let frame: Uint8Array | undefined
  let previousScene: ReturnType<typeof readVisionScene> | undefined
  let previousLevel = 0
  let decision: LearnedDecision | undefined
  return {
    movement(run: PhantomRun) {
      if (untilNext === 0) {
        const started = performance.now()
        const hud = observeHud(run)
        frame = mode === 'vision' ? paintVision(run.board) : undefined
        const scene = frame ? readVisionScene(frame) : undefined
        const clearance: number[] = []
        const moves = scene ? observeSceneMoves(scene, hud[4] === 1, {
          enemyStep: PLAYER_STEP * levelRules(run.level).enemySpeed,
          previousEnemies: run.level === previousLevel ? previousScene?.enemies ?? [] : [],
          clearance,
        }) : observeState(run.board)
        previousScene = scene
        previousLevel = run.level
        const logits = actor([...moves, ...hud])
        const preferred = logits.reduce((best, score, candidate) => score > logits[best] ? candidate : best, 0)
        const planned = scene ? recover(scene, moves, hud, preferred) : preferred
        action = avoidCollision(planned, clearance, logits)
        const duration = performance.now() - started
        const weights = logits.map(logit => Math.exp(logit - logits[preferred]))
        const total = weights.reduce((sum, weight) => sum + weight, 0)
        const alternatives = Array.from(weights, (weight, id) => ({ action: id, probability: weight / total }))
          .sort((a, b) => b.probability - a.probability).slice(0, 3)
        decision = { action, alternatives, duration, recovering: planned !== preferred, avoidingEnemy: action !== planned }
        untilNext = TICKS_PER_ACTION
      }
      untilNext--
      return ACTIONS[action]
    },
    get action() { return action },
    get frame() { return frame },
    get decision() { return decision },
  }
}
