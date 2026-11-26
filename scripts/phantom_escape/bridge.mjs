import { createInterface } from 'node:readline'
import { deflateRawSync } from 'node:zlib'
import { createRun } from '../../src/demos/phantom-escape/engine.ts'
import { createVisionPainter, VISION_HEIGHT, VISION_HISTORY, VISION_WIDTH } from '../../src/demos/phantom-escape/vision.ts'
import { advance, describe, observe, spec } from './simulation.ts'
import { createTeacher } from './teacher.ts'
import { createMoveObservation, MOVE_FIELDS } from '../../src/demos/phantom-escape/forecast.ts'
import { observeVisionMoves } from '../../src/demos/phantom-escape/vision-spatial.ts'
import { observeHud } from '../../src/demos/phantom-escape/observations.ts'

let run
let teacher
let features
const observeMoves = createMoveObservation()
const paintVision = createVisionPainter()
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  try {
    const message = JSON.parse(line)
    if (message.command === 'spec') {
      process.stdout.write(JSON.stringify({
        ...spec, movesSize: spec.actionCount * MOVE_FIELDS,
        visionShape: [VISION_HEIGHT, VISION_WIDTH, 3], visionHistory: VISION_HISTORY,
      }) + '\n')
      continue
    }
    let transition
    let action
    if (message.command === 'reset') {
      if (!Number.isInteger(message.seed) || message.seed < 0 || message.seed > 0xffffffff) {
        throw new RangeError('Expected an unsigned 32-bit seed')
      }
      const profile = message.features ?? 'grid'
      if (!['grid', 'navigation', 'vision', 'vision-spatial'].includes(profile)) throw new RangeError('Unknown observation profile')
      run = createRun(message.seed)
      teacher = undefined
      features = profile
    } else if (message.command === 'step' || message.command === 'expert') {
      if (!run) throw new Error('Reset the episode before stepping')
      if (message.command === 'expert') {
        if (run.ended) throw new Error('Reset the episode before stepping')
        teacher ??= createTeacher()
        action = teacher(run)
      } else {
        teacher = undefined
        action = message.action
      }
      transition = advance(run, action)
    } else {
      throw new Error('Unknown simulator command')
    }
    let observation
    if (features === 'vision' || features === 'vision-spatial') {
      const frame = paintVision(run.board)
      const hud = observeHud(run)
      observation = { frame: deflateRawSync(frame, { level: 1 }).toString('base64'), hud }
      if (features === 'vision-spatial') observation.moves = observeVisionMoves(frame, hud[4] === 1)
    } else {
      observation = features === 'navigation' ? { moves: observeMoves(run.board), hud: observeHud(run) } : observe(run)
    }
    process.stdout.write(JSON.stringify({
      observation,
      info: describe(run), transition,
      ...(message.command === 'expert' ? { action } : {}),
    }) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }) + '\n')
  }
}
