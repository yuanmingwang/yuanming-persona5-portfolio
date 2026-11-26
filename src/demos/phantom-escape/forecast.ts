import { advanceActors, coinsCollected, HIT_DISTANCE, PLAYER_STEP } from './engine.ts'
import type { Board, Movement, Sound } from './engine.ts'
import { cellAt, centerOf, floorNeighbors, TILE } from './map.ts'
import { ACTIONS, TICKS_PER_ACTION } from './observations.ts'

export function projectMove(board: Board, action: Movement) {
  const projected = { ...board, player: { ...board.player }, enemies: board.enemies.map(enemy => ({ ...enemy })) }
  const sounds: Sound[] = []
  let clearance = Infinity
  let pickup = false
  for (let tick = 0; tick < TICKS_PER_ACTION; tick++) {
    const cell = advanceActors(projected, action, sounds)
    for (const enemy of projected.enemies) {
      clearance = Math.min(clearance, Math.hypot(projected.player.x - enemy.x, projected.player.y - enemy.y))
    }
    if (clearance <= HIT_DISTANCE) break
    if (board.coins.has(cell)) {
      const coin = centerOf(cell)
      pickup ||= Math.hypot(projected.player.x - coin.x, projected.player.y - coin.y) <= 8
    }
  }
  return { player: projected.player, clearance, caught: clearance <= HIT_DISTANCE, pickup }
}

export function distanceField(floor: Uint8Array, targets: Iterable<number>) {
  const distances = new Int16Array(floor.length).fill(-1)
  const queue = [...targets]
  for (const cell of queue) distances[cell] = 0
  for (let i = 0; i < queue.length; i++) {
    for (const next of floorNeighbors(floor, queue[i])) {
      if (distances[next] >= 0) continue
      distances[next] = distances[queue[i]] + 1
      queue.push(next)
    }
  }
  return distances
}

export function distanceAt(floor: Uint8Array, field: Int16Array, player: Board['player']) {
  const cell = cellAt(player.x, player.y)
  if (field[cell] < 0) return 0
  let best = Infinity
  // Consider nearby tile centers to retain fractional progress inside a tile.
  for (const neighbor of [cell, ...floorNeighbors(floor, cell)]) {
    const center = centerOf(neighbor)
    const offset = Math.abs(player.x - center.x) + Math.abs(player.y - center.y)
    best = Math.min(best, field[neighbor] + offset / TILE)
  }
  return best
}

export const MOVE_FIELDS = 11
const moveScale = PLAYER_STEP * TICKS_PER_ACTION

export function createMoveObservation() {
  let boardSeen: Board | undefined
  let coinCount = -1
  let viaCoin = new Int16Array(0)
  let viaExit = new Int16Array(0)

  return (board: Board) => {
    const { floor, exit } = board.maze
    if (boardSeen !== board) viaExit = distanceField(floor, [exit])
    if (boardSeen !== board || coinCount !== board.coins.size) {
      viaCoin = distanceField(floor, board.coins)
      coinCount = board.coins.size
      boardSeen = board
    }
    const coinDistance = distanceAt(floor, viaCoin, board.player)
    const exitDistance = distanceAt(floor, viaExit, board.player)
    const exiting = coinsCollected(board) >= board.quota
    const moves = []
    for (const action of ACTIONS) {
      const { player, clearance, caught, pickup } = projectMove(board, action)
      const dx = (player.x - board.player.x) / moveScale
      const dy = (player.y - board.player.y) / moveScale
      const gainCoin = coinDistance - distanceAt(floor, viaCoin, player)
      const gainExit = exitDistance - distanceAt(floor, viaExit, player)
      moves.push(action.x, action.y, dx, dy, Math.hypot(dx, dy),
        gainCoin, gainExit, Math.min(clearance / (3 * TILE), 1), Number(caught), Number(pickup),
        exiting ? gainExit : gainCoin)
    }
    // Keep tiny floating-point overshoots out of the observation space.
    return moves.map(value => Math.min(1, Math.max(-1, value)))
  }
}
