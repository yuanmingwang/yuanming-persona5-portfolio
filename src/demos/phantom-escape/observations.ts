import { coinsCollected, TICKS_PER_SECOND } from './engine.ts'
import type { Movement, PhantomRun } from './engine.ts'

export const ACTIONS: readonly Movement[] = [
  { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
]
export const TICKS_PER_ACTION = TICKS_PER_SECOND / 10

export function observeHud(run: PhantomRun) {
  const { board } = run
  const collected = coinsCollected(board)
  return [board.ticksLeft / (90 * TICKS_PER_SECOND), run.level / (run.level + 1),
    board.quota / 40, collected / 40, Number(collected >= board.quota)]
}
