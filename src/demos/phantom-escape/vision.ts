import { coinsCollected } from './engine.ts'
import type { Board } from './engine.ts'
import { centerOf, COLUMNS, HEIGHT, TILE, WIDTH } from './map.ts'

export const VISION_WIDTH = WIDTH / 2
export const VISION_HEIGHT = HEIGHT / 2
export const VISION_HISTORY = 4

type Color = readonly [number, number, number]
const colors = {
  wall: [16, 14, 24], floor: [44, 36, 54], coin: [255, 197, 65],
  locked: [250, 65, 115], exit: [65, 245, 161], player: [255, 248, 228],
  patroller: [151, 107, 255], chaser: [248, 90, 60],
} as const

function paintRect(frame: Uint8Array, x: number, y: number, width: number, height: number, color: Color) {
  for (let row = Math.max(0, y); row < Math.min(VISION_HEIGHT, y + height); row++) {
    for (let col = Math.max(0, x); col < Math.min(VISION_WIDTH, x + width); col++) {
      const offset = (row * VISION_WIDTH + col) * 3
      frame[offset] = color[0]
      frame[offset + 1] = color[1]
      frame[offset + 2] = color[2]
    }
  }
}

function marker(frame: Uint8Array, point: Board['player'], radius: number, color: Color) {
  paintRect(frame, Math.round(point.x / 2) - radius, Math.round(point.y / 2) - radius,
    radius * 2, radius * 2, color)
}

export function createVisionPainter() {
  let floorSeen: Uint8Array | undefined
  const terrain = new Uint8Array(VISION_WIDTH * VISION_HEIGHT * 3)
  return (board: Board) => {
    const { floor, exit } = board.maze
    if (floorSeen !== floor) {
      const tile = TILE / 2
      for (const [cell, walkable] of floor.entries()) {
        paintRect(terrain, cell % COLUMNS * tile, Math.floor(cell / COLUMNS) * tile, tile, tile,
          walkable ? colors.floor : colors.wall)
      }
      floorSeen = floor
    }

    const frame = terrain.slice()
    marker(frame, centerOf(exit), 3, coinsCollected(board) >= board.quota ? colors.exit : colors.locked)
    for (const coin of board.coins) marker(frame, centerOf(coin), 2, colors.coin)
    for (const enemy of board.enemies) marker(frame, enemy, 3, colors[enemy.kind])
    marker(frame, board.player, 3, colors.player)
    return frame
  }
}
