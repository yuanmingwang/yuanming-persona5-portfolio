import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createFlight, flap, stepFlight } from '../src/demos/night-flight/flight.ts'
import { SAMPLE_TICKS } from '../src/demos/night-flight/frames.ts'
import { createPilot } from '../src/demos/night-flight/pilot.ts'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '15' },
    target: { type: 'string', default: '150' },
    'first-seed': { type: 'string', default: '1' },
    weights: { type: 'string' },
  },
})
const runs = Number(values.runs)
const target = Number(values.target)
const firstSeed = Number(values['first-seed'])
if (![runs, target, firstSeed].every(value => Number.isSafeInteger(value) && value > 0)) {
  throw new Error('Pass positive integers for --runs, --target and --first-seed.')
}
const weights = values.weights ? JSON.parse(readFileSync(values.weights, 'utf-8')) : undefined

const scores = []
const start = performance.now()
for (let seed = firstSeed; seed < firstSeed + runs; seed++) {
  let state = seed
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
  const flight = createFlight()
  const pilot = createPilot(weights)
  let lastSample
  while (!flight.crashed && flight.score < target) {
    if (flight.ticks % SAMPLE_TICKS === 0) {
      lastSample = pilot.sample(flight)
      if (lastSample.flap) {
        pilot.recordFlap(flight.ticks)
        flap(flight)
      }
    }
    stepFlight(flight, random)
  }
  scores.push(flight.score)
  const lastDetection = lastSample?.gapY?.toFixed(1) ?? '—'
  console.log(`Seed ${seed}: ${flight.score} pipes (${flight.crashed ? `crashed, last detected gap y=${lastDetection}` : 'target reached'})`)
}

scores.sort((left, right) => left - right)
console.log(`Minimum ${scores[0]}, median ${scores[Math.floor((scores.length - 1) / 2)]}, ${scores.filter(score => score === target).length}/${runs} reached the target in ${((performance.now() - start) / 1000).toFixed(1)} s.`)
