import { closeSync, openSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createFlight, GROUND, stepFlight } from '../src/demos/night-flight/flight.ts'
import { captureFrame, FRAME_SIZE } from '../src/demos/night-flight/frames.ts'

const { positionals: [destination], values } = parseArgs({
  allowPositionals: true,
  options: {
    frames: { type: 'string', default: '1400' },
    seed: { type: 'string', default: '829761' },
  },
})
const count = Number(values.frames)
let seed = Number(values.seed)
if (!destination || !Number.isSafeInteger(count) || count < 10 ||
    !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
  throw new Error('Usage: node scripts/sample-night-flight.mjs OUTPUT --frames COUNT --seed SEED')
}

function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

// Sample independent scenes, including tight late-game gaps and bird heights
// that a successful playthrough seldom visits. Use the browser's pixel renderer.
function sampleScene() {
  const flight = createFlight()
  flight.distance = random() * 15000
  flight.score = Math.floor(random() * 65)
  flight.ticks = Math.floor(random() * 12)
  const firstPipe = flight.pipes[0]
  firstPipe.x = random() * 152 - 30
  firstPipe.center = 58 + random() * 79
  firstPipe.gap = Math.max(59, 76 - .5 * flight.score)
  for (let step = 0; step < 4; step++) stepFlight(flight, random)
  flight.y = 12 + random() * (GROUND - 24)
  return captureFrame(flight)
}

const descriptor = openSync(destination, 'wx')
try {
  for (let index = 0; index < count; index++) writeFileSync(descriptor, sampleScene())
} finally {
  closeSync(descriptor)
}
console.log(`Captured ${count} frames of ${FRAME_SIZE} × ${FRAME_SIZE} pixels (${count * FRAME_SIZE ** 2} bytes) in ${destination}.`)
