import { HIT_DISTANCE, movePlayerOnFloor, PLAYER_STEP } from './engine.ts'
import { cellAt, centerOf, COLUMNS, ROWS, TILE } from './map.ts'
import { VISION_ACTOR_RADIUS, VISION_COLORS, VISION_HEIGHT, VISION_WIDTH } from './vision.ts'
import { distanceAt, distanceField, MOVE_FIELDS } from './forecast.ts'
import { ACTIONS, TICKS_PER_ACTION } from './observations.ts'

type Point = { x: number; y: number }
type EnemyMarker = Point & { color: number }
const stride = TILE / 2

function pixel(frame: Uint8Array, x: number, y: number) {
  return frame[(y * VISION_WIDTH + x) * 3 + 1]
}

function isFullMarker(frame: Uint8Array, x: number, y: number, color: number) {
  const size = 2 * VISION_ACTOR_RADIUS
  if (x < 1 || y < 1 || x + size >= VISION_WIDTH || y + size >= VISION_HEIGHT) return false
  if (pixel(frame, x - 1, y) === color || pixel(frame, x, y - 1) === color ||
    pixel(frame, x + size, y) === color || pixel(frame, x, y + size) === color) return false
  for (let row = y; row < y + size; row++) {
    for (let col = x; col < x + size; col++) {
      if (pixel(frame, col, row) !== color) return false
    }
  }
  return true
}

export function readVisionScene(frame: Uint8Array) {
  const floor = new Uint8Array(COLUMNS * ROWS)
  const coins: number[] = []
  const enemyPixels: Point[] = []
  const enemies: EnemyMarker[] = []
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
            if (isFullMarker(frame, x, y, green)) {
              enemies.push({ x: 2 * (x + VISION_ACTOR_RADIUS), y: 2 * (y + VISION_ACTOR_RADIUS), color: green })
            }
          }
          // Exit pixels can remain visible when an actor occludes its center.
          if (green === VISION_COLORS.exit[1] || green === VISION_COLORS.locked[1]) exit = cell
        }
      }
      floor[cell] = Number(walls < stride * stride / 2)
    }
  }
  const player = { x: left + right + 1, y: top + bottom + 1 }
  return { floor, coins, exit, player, enemyPixels, enemies }
}

export function observeVisionMoves(frame: Uint8Array, exiting: boolean) {
  return observeSceneMoves(readVisionScene(frame), exiting)
}

export function observeSceneMoves(
  { floor, coins, exit, player, enemyPixels, enemies }: ReturnType<typeof readVisionScene>,
  exiting: boolean,
  safety?: { enemyStep: number; previousEnemies: readonly EnemyMarker[]; clearance: number[] },
) {
  if (!Number.isFinite(player.x) || floor[cellAt(player.x, player.y)] !== 1) {
    // The painter puts the player last. This fallback keeps malformed or blank input finite.
    return Array<number>(ACTIONS.length * MOVE_FIELDS).fill(0)
  }
  const viaCoin = distanceField(floor, coins)
  const viaExit = distanceField(floor, exit === undefined ? [] : [exit])
  const coinDistance = distanceAt(floor, viaCoin, player)
  const exitDistance = distanceAt(floor, viaExit, player)
  const threats = safety ? enemies.map(enemy => {
    const candidates = safety.previousEnemies.filter(previous => previous.color === enemy.color &&
      Math.abs(previous.x - enemy.x) + Math.abs(previous.y - enemy.y) <= safety.enemyStep * TICKS_PER_ACTION + 2)
    const previous = candidates.length === 1 ? candidates[0] : undefined
    let dx = 0
    let dy = 0
    if (previous) {
      // Enemies move along tile axes and can turn at tile centers.
      if (enemy.y === previous.y) dx = Math.sign(enemy.x - previous.x)
      if (enemy.x === previous.x) dy = Math.sign(enemy.y - previous.y)
    }
    const center = centerOf(cellAt(enemy.x, enemy.y))
    const along = dx * (center.x - enemy.x) + dy * (center.y - enemy.y)
    const untilTurn = dx || dy ? Math.max(0, (along + TILE) % TILE - 1) : 0
    return { ...enemy, dx, dy, untilTurn }
  }) : []
  const markerRadius = 2 * VISION_ACTOR_RADIUS
  const untrackedPixels = safety ? enemyPixels.filter(pixel => !threats.some(enemy =>
    Math.abs(pixel.x - enemy.x) < markerRadius && Math.abs(pixel.y - enemy.y) < markerRadius)) : []
  const moves = []
  for (const action of ACTIONS) {
    const next = { ...player }
    let clearance = Infinity
    let predictedClearance = Infinity
    let pickup = false
    for (let tick = 0; tick < TICKS_PER_ACTION; tick++) {
      movePlayerOnFloor(next, floor, action)
      let visibleClearance = Infinity
      for (const enemy of enemyPixels) {
        visibleClearance = Math.min(visibleClearance, Math.hypot(next.x - enemy.x, next.y - enemy.y))
      }
      clearance = Math.min(clearance, visibleClearance)
      if (safety) {
        const travel = (tick + 1) * safety.enemyStep
        for (const enemy of threats) {
          const advance = Math.min(travel, enemy.untilTurn)
          const distance = Math.hypot(next.x - enemy.x - enemy.dx * advance, next.y - enemy.y - enemy.dy * advance)
          // After a possible turn, treat the remaining travel as uncertainty in any direction.
          predictedClearance = Math.min(predictedClearance, distance - (travel - advance) - 2)
        }
        for (const pixel of untrackedPixels) {
          const distance = Math.hypot(next.x - pixel.x, next.y - pixel.y)
          predictedClearance = Math.min(predictedClearance, distance + 1 - travel)
        }
      }
      const cell = cellAt(next.x, next.y)
      if (viaCoin[cell] === 0) {
        const center = centerOf(cell)
        pickup ||= Math.hypot(center.x - next.x, center.y - next.y) <= 8
      }
    }
    safety?.clearance.push(predictedClearance)
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
