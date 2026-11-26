import { coinsCollected, PLAYER_STEP, stepRun, TICKS_PER_SECOND } from '../../src/demos/phantom-escape/engine.ts'
import type { Movement, PhantomRun } from '../../src/demos/phantom-escape/engine.ts'
import { cellAt, centerOf, COLUMNS, ROWS } from '../../src/demos/phantom-escape/map.ts'

export const ACTIONS: readonly Movement[] = [
  { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
]
export const TICKS_PER_ACTION = TICKS_PER_SECOND / 10
const CELL_COUNT = COLUMNS * ROWS

export const spec = {
  version: 1,
  gridShape: [7, ROWS, COLUMNS],
  hudSize: 5,
  actionCount: ACTIONS.length,
  ticksPerAction: TICKS_PER_ACTION,
}

export function observe(run: PhantomRun) {
  const { board } = run
  const grid = new Float32Array(spec.gridShape[0] * CELL_COUNT)
  for (const [cell, floor] of board.maze.floor.entries()) grid[cell] = 1 - floor
  for (const coin of board.coins) grid[CELL_COUNT + coin] = 1
  const counts = new Map<number, number>()
  for (const enemy of board.enemies) {
    const cell = cellAt(enemy.x, enemy.y)
    const target = centerOf(enemy.next)
    grid[2 * CELL_COUNT + cell] = 1
    // Average velocities within a tile when multiple enemies overlap.
    grid[5 * CELL_COUNT + cell] += Math.sign(target.x - enemy.x)
    grid[6 * CELL_COUNT + cell] += Math.sign(target.y - enemy.y)
    counts.set(cell, (counts.get(cell) ?? 0) + 1)
  }
  for (const [cell, count] of counts) {
    grid[5 * CELL_COUNT + cell] *= board.enemyStep / PLAYER_STEP / count
    grid[6 * CELL_COUNT + cell] *= board.enemyStep / PLAYER_STEP / count
  }
  grid[3 * CELL_COUNT + cellAt(board.player.x, board.player.y)] = 1
  grid[4 * CELL_COUNT + board.maze.exit] = 1
  return {
    grid: Array.from(grid),
    hud: observeHud(run),
  }
}

export function observeHud(run: PhantomRun) {
  const { board } = run
  const collected = coinsCollected(board)
  return [board.ticksLeft / (90 * TICKS_PER_SECOND), run.level / (run.level + 1),
    board.quota / 40, collected / 40, Number(collected >= board.quota)]
}

export function advance(run: PhantomRun, action: number) {
  const movement = ACTIONS[action]
  if (!Number.isInteger(action) || !movement) throw new RangeError('Invalid Phantom Escape action')
  if (run.ended) throw new Error('Reset the episode before stepping again')

  let reward = 0
  let ticks = 0
  let moved = false
  const events = []
  while (ticks < TICKS_PER_ACTION && !run.ended) {
    const { board, level } = run
    const x = board.player.x
    const y = board.player.y
    const remaining = board.coins.size
    const sounds = stepRun(run, movement)
    moved ||= x !== board.player.x || y !== board.player.y
    ticks++
    events.push(...sounds)
    reward += remaining - board.coins.size
    if (sounds.includes('unlock_exit')) reward += 2
    if (run.level !== level) reward += 10
  }
  if (action !== 0 && !moved && !run.ended) reward -= .02
  if (run.ended) reward -= run.ended === 'caught' ? 10 : 5
  reward -= .005 * ticks / TICKS_PER_ACTION
  return { reward, ticks, events }
}

export function describe(run: PhantomRun) {
  const { board } = run
  return {
    seed: run.seed,
    level: run.level,
    score: run.score,
    outcome: run.ended,
    layout: board.maze.family,
    ticksLeft: board.ticksLeft,
    coins: coinsCollected(board),
    quota: board.quota,
  }
}
