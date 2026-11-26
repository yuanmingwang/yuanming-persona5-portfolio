import { HIT_DISTANCE, movePlayerOnFloor, PLAYER_STEP } from './engine.ts'
import { cellAt, centerOf, COLUMNS, ROWS, TILE } from './map.ts'
import { VISION_COLORS, VISION_WIDTH } from './vision.ts'
import { distanceAt, distanceField, MOVE_FIELDS } from './forecast.ts'
import { ACTIONS, TICKS_PER_ACTION } from './observations.ts'

type Point = { x: number; y: number }
const stride = TILE / 2

function pixel(frame: Uint8Array, x: number, y: number) {
  return frame[(y * VISION_WIDTH + x) * 3 + 1]
}

export function readVisionScene(frame: Uint8Array) {
  const floor = new Uint8Array(COLUMNS * ROWS)
  const coins: number[] = []
  const enemyPixels: Point[] = []
  let exit: number | undefined
  let left = Infinity
  let top = Infinity
  let bottom = -Infinity
  let right = -Infinity
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const cell = row * COLUMNS + col
      const startX = col * stride
      const startY = row * stride
      const middle = pixel(frame, startX + stride / 2, startY + stride / 2)
      if (middle === VISION_COLORS.coin[1]) coins.push(cell)
      if (middle === VISION_COLORS.exit[1] || middle === VISION_COLORS.locked[1]) exit = cell
      let walls = 0
      for (let y = startY; y < startY + stride; y++) {
        for (let x = startX; x < startX + stride; x++) {
          const green = pixel(frame, x, y)
          if (green === VISION_COLORS.wall[1]) walls++
          if (green === VISION_COLORS.player[1]) {
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
          }
          if (green === VISION_COLORS.chaser[1] || green === VISION_COLORS.patroller[1]) {
            // Keep sparse samples of each visible silhouette for proximity estimates.
            if (x % 2 === 0 && y % 2 === 0) enemyPixels.push({ x: 2 * x + 1, y: 2 * y + 1 })
          }
          // Exit pixels can remain visible when an actor occludes its center.
          if (green === VISION_COLORS.exit[1] || green === VISION_COLORS.locked[1]) exit = cell
        }
      }
      floor[cell] = Number(walls < stride * stride / 2)
    }
  }
  const player = { x: left + right + 1, y: top + bottom + 1 }
  return { floor, coins, exit, player, enemyPixels }
}

export function observeVisionMoves(frame: Uint8Array, exiting: boolean) {
  const { floor, coins, exit, player, enemyPixels } = readVisionScene(frame)
  if (!Number.isFinite(player.x) || floor[cellAt(player.x, player.y)] !== 1) {
    // The painter puts the player last. This fallback keeps malformed or blank input finite.
    return Array<number>(ACTIONS.length * MOVE_FIELDS).fill(0)
  }
  const viaCoin = distanceField(floor, coins)
  const viaExit = distanceField(floor, exit === undefined ? [] : [exit])
  const coinDistance = distanceAt(floor, viaCoin, player)
  const exitDistance = distanceAt(floor, viaExit, player)
  const moves = []
  for (const action of ACTIONS) {
    const next = { ...player }
    let clearance = Infinity
    let pickup = false
    for (let tick = 0; tick < TICKS_PER_ACTION; tick++) {
      movePlayerOnFloor(next, floor, action)
      for (const enemy of enemyPixels) {
        clearance = Math.min(clearance, Math.hypot(next.x - enemy.x, next.y - enemy.y))
      }
      const cell = cellAt(next.x, next.y)
      if (viaCoin[cell] === 0) {
        const center = centerOf(cell)
        pickup ||= Math.hypot(center.x - next.x, center.y - next.y) <= 8
      }
    }
    const dx = (next.x - player.x) / (PLAYER_STEP * TICKS_PER_ACTION)
    const dy = (next.y - player.y) / (PLAYER_STEP * TICKS_PER_ACTION)
    const gainCoin = coinDistance - distanceAt(floor, viaCoin, next)
    const gainExit = exitDistance - distanceAt(floor, viaExit, next)
    moves.push(action.x, action.y, dx, dy, Math.hypot(dx, dy), gainCoin, gainExit,
      Math.min((clearance + 3) / (3 * TILE), 1), Number(clearance + 3 <= HIT_DISTANCE), Number(pickup),
      exiting ? gainExit : gainCoin)
  }
  return moves.map(value => Math.min(1, Math.max(-1, value)))
}
