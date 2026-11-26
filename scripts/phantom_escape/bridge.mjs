import { createInterface } from 'node:readline'
import { createRun } from '../../src/demos/phantom-escape/engine.ts'
import { advance, describe, observe, observeHud, spec } from './simulation.ts'
import { createTeacher } from './teacher.ts'
import { createMoveObservation, MOVE_FIELDS } from './forecast.ts'

let run
let teacher
let navigation = false
const observeMoves = createMoveObservation()
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  try {
    const message = JSON.parse(line)
    if (message.command === 'spec') {
      process.stdout.write(JSON.stringify({ ...spec, movesSize: spec.actionCount * MOVE_FIELDS }) + '\n')
      continue
    }
    let transition
    let action
    if (message.command === 'reset') {
      if (!Number.isInteger(message.seed) || message.seed < 0 || message.seed > 0xffffffff) {
        throw new RangeError('Expected an unsigned 32-bit seed')
      }
      run = createRun(message.seed)
      teacher = undefined
      navigation = message.features === 'navigation'
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
    process.stdout.write(JSON.stringify({
      observation: navigation ? { moves: observeMoves(run.board), hud: observeHud(run) } : observe(run),
      info: describe(run), transition,
      ...(message.command === 'expert' ? { action } : {}),
    }) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }) + '\n')
  }
}
