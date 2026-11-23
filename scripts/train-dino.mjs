// Run locally: node scripts/train-dino.mjs
// Train a binary logistic classifier on two rendered grayscale frames per example.
import { writeFileSync } from 'node:fs'
import { CACTUS_FORMATIONS } from '../src/demos/dino/cacti.ts'
import {
  drawObservation, readVision, DINO_FRONT, FRAME_WIDTH, FRAME_HEIGHT, SAMPLE_TICKS,
} from '../src/demos/dino/runner.ts'

let seed = 32007
function random() {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
  return seed / 2 ** 32
}

const current = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT)
const previous = current.slice()
const weights = [0, 0, 0]
const threshold = .5
const examples = 48000

for (let step = 0; step < examples; step++) {
  const speed = .83 + random() * .65
  const gap = random() * 30
  const shape = CACTUS_FORMATIONS[Math.floor(random() * CACTUS_FORMATIONS.length)]
  const obstacle = { x: DINO_FRONT + gap, shape }
  drawObservation(current, 0, [obstacle])
  drawObservation(previous, 0, [{ ...obstacle, x: obstacle.x + speed * SAMPLE_TICKS }])
  const features = readVision(current, previous)
  // The teacher uses true position and speed; inference only sees the two frames.
  const label = gap <= 2.5 + speed * 8 ? 1 : 0
  const input = [1, features.gap, features.speed]
  const logit = weights.reduce((sum, weight, index) => sum + weight * input[index], 0)
  const error = label - 1 / (1 + Math.exp(-logit))
  const learningRate = .045 / (1 + step / 15000)
  input.forEach((value, index) => { weights[index] += learningRate * error * value })
}

const model = {
  weights: weights.map(weight => Number(weight.toFixed(6))),
  threshold,
}
writeFileSync(new URL('../src/demos/dino/model.json', import.meta.url), JSON.stringify(model, null, 2) + '\n')
console.log(model)
