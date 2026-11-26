import { PLAYER_STEP } from './engine.ts'
import { cellAt, centerOf, TILE, tileDistance } from './map.ts'
import { MOVE_FIELDS } from './forecast.ts'
import { ACTIONS, TICKS_PER_ACTION } from './observations.ts'
import { findRoute } from './path.ts'
import type { readVisionScene } from './vision-spatial.ts'

type Scene = ReturnType<typeof readVisionScene>
const STALL_SAMPLES = 26
const RECOVERY_SAMPLES = 24
const MOVE_PIXELS = PLAYER_STEP * TICKS_PER_ACTION

export function createVisionRecovery() {
  let recent: number[] = []
  let lastCollected: number | undefined
  let lastLevel: number | undefined
  let exit: number | undefined
  let remaining = 0
  let route: number[] = []
  const failures = new Uint8Array(ACTIONS.length)
  let previous: Scene['player'] | undefined
  let previousAction: number | undefined

  return (scene: Scene, moves: readonly number[], hud: readonly number[], preferred: number) => {
    const { floor, player, coins, enemyPixels } = scene
    const cell = cellAt(player.x, player.y)
    const [, level, , collected, unlocked] = hud
    const newLevel = level !== lastLevel
    if (newLevel) {
      lastLevel = level
      exit = undefined
    }
    exit = scene.exit ?? exit

    if (newLevel || collected !== lastCollected || !previous) {
      lastCollected = collected
      recent = []
      remaining = 0
      route = []
      previousAction = undefined
      failures.fill(0)
    }
    if (floor[cell] !== 1) return preferred

    if (previous && cellAt(previous.x, previous.y) !== cell) failures.fill(0)
    if (previousAction !== undefined && previousAction !== 0 && previous) {
      if (Math.hypot(player.x - previous.x, player.y - previous.y) < 2) {
        failures[previousAction] = Math.min(failures[previousAction] + 1, 6)
      } else {
        failures[previousAction] = 0
      }
    }
    previous = player
    previousAction = undefined
    recent.push(cell)
    if (recent.length > STALL_SAMPLES) recent.shift()

    if (!remaining && recent.length === STALL_SAMPLES && new Set(recent).size <= 4) {
      // Stay in recovery for a short route segment so the actor cannot immediately reverse it.
      remaining = RECOVERY_SAMPLES
      route = []
      failures.fill(0)
    }
    if (!remaining) return preferred
    remaining--
    if (!remaining) recent = []

    const index = route.indexOf(cell)
    if (index < 0 || remaining % 6 === 5) {
      const targets = unlocked ? (exit === undefined ? [] : [exit]) : coins
      const sorted = [...targets].sort((a, b) => tileDistance(cell, a) - tileDistance(cell, b)).slice(0, 6)
      const risk = new Float32Array(floor.length)
      for (const tile of recent) risk[tile] += .11
      for (const [tile, walkable] of floor.entries()) {
        if (!walkable) continue
        const point = centerOf(tile)
        let distance = Infinity
        for (const enemy of enemyPixels) distance = Math.min(distance, Math.hypot(point.x - enemy.x, point.y - enemy.y))
        risk[tile] += Math.max(0, 48 - distance) / TILE
      }
      const explored = new Set<number>()
      let bestCost = Infinity
      route = []
      for (const target of sorted) {
        const result = findRoute(floor, cell, target, risk, explored)
        if (result.cost < bestCost) {
          bestCost = result.cost
          route = result.cells
        }
      }
    }
    const currentIndex = route.indexOf(cell)
    if (currentIndex < 0) return preferred
    const target = centerOf(route[currentIndex + 1] ?? cell)
    let bestAction = preferred
    let bestScore = -Infinity
    for (let action = 0; action < ACTIONS.length; action++) {
      const offset = action * MOVE_FIELDS
      // Reuse the actor's projected displacement, proximity, collision, and pickup features.
      const x = player.x + moves[offset + 2] * MOVE_PIXELS
      const y = player.y + moves[offset + 3] * MOVE_PIXELS
      const distance = Math.hypot(x - target.x, y - target.y)
      const danger = Math.max(0, .5 - moves[offset + 7])
      const score = -distance - danger * 48 - moves[offset + 8] * 150
        + moves[offset + 9] * 3 - failures[action] * 8 - (action === 0 ? 3 : 0)
      if (score > bestScore) {
        bestScore = score
        bestAction = action
      }
    }
    previousAction = bestAction
    return bestAction
  }
}
