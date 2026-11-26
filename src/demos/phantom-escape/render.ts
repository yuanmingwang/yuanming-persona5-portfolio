import { coinsCollected } from './engine.ts'
import type { PhantomRun } from './engine.ts'
import { centerOf, COLUMNS, HEIGHT, TILE, WIDTH } from './map.ts'
import type { TacticalPlan } from './tactics.ts'

export function createMazePainter(context: CanvasRenderingContext2D) {
  const backdrop = document.createElement('canvas')
  backdrop.width = WIDTH
  backdrop.height = HEIGHT
  const background = backdrop.getContext('2d')
  let lastFloor: Uint8Array | undefined

  return (run: PhantomRun, plan?: TacticalPlan) => {
    const { maze, player, coins, quota, enemies } = run.board
    if (background && lastFloor !== maze.floor) {
      for (const [cell, isFloor] of maze.floor.entries()) {
        const x = (cell % COLUMNS) * TILE
        const y = Math.floor(cell / COLUMNS) * TILE
        background.fillStyle = isFloor ? (cell % 3 ? '#251b29' : '#2b2030') : '#131019'
        background.fillRect(x, y, TILE, TILE)
        if (!isFloor && maze.floor[cell + COLUMNS]) {
          background.fillStyle = '#553245'
          background.fillRect(x, y + TILE - 3, TILE, 3)
        }
      }
      lastFloor = maze.floor
    }
    context.drawImage(backdrop, 0, 0)

    if (plan?.floor === maze.floor) {
      context.fillStyle = '#5d9fea'
      context.globalAlpha = .38
      for (const cell of plan.explored) {
        const { x, y } = centerOf(cell)
        context.fillRect(x - 1, y - 1, 2, 2)
      }
      context.fillStyle = '#ff4a62'
      for (const [cell, risk] of plan.risk.entries()) {
        if (risk < .22) continue
        const { x, y } = centerOf(cell)
        context.globalAlpha = Math.min(.48, .09 + risk * .055)
        context.fillRect(x - 8, y - 8, TILE, TILE)
      }
      context.globalAlpha = .9
      context.strokeStyle = '#54e0db'
      context.lineWidth = 2
      context.beginPath()
      for (const [index, cell] of plan.route.entries()) {
        const { x, y } = centerOf(cell)
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
      context.globalAlpha = 1
    }

    const exit = centerOf(maze.exit)
    const open = coinsCollected(run.board) >= quota
    context.fillStyle = open ? '#78f8c0' : '#e3446c'
    context.fillRect(exit.x - 6, exit.y - 7, 12, 14)
    context.fillStyle = '#16111b'
    context.fillRect(exit.x - 4, exit.y - 5, 8, 12)
    context.fillStyle = open ? '#78f8c0' : '#e3446c'
    if (open) {
      context.fillRect(exit.x - 1, exit.y - 2, 2, 6)
      context.fillRect(exit.x - 3, exit.y, 6, 2)
    } else {
      context.fillRect(exit.x - 3, exit.y, 6, 3)
    }

    for (const cell of coins) {
      const { x, y } = centerOf(cell)
      context.fillStyle = '#ffbd53'
      context.fillRect(x - 3, y - 2, 6, 4)
      context.fillRect(x - 2, y - 3, 4, 6)
      context.fillStyle = '#fff0a1'
      context.fillRect(x - 1, y - 2, 1, 3)
    }

    for (const ghost of enemies) {
      const x = Math.round(ghost.x)
      const y = Math.round(ghost.y)
      context.fillStyle = ghost.kind === 'chaser' ? '#ff6382' : '#ae8aff'
      context.fillRect(x - 5, y - 3, 10, 6)
      context.fillRect(x - 3, y - 5, 6, 2)
      context.fillRect(x - 5, y + 3, 3, 2)
      context.fillRect(x + 2, y + 3, 3, 2)
      context.fillStyle = '#1d0d1b'
      context.fillRect(x - 3, y - 2, 2, 2)
      context.fillRect(x + 1, y - 2, 2, 2)
      if (ghost.chasing) {
        context.fillStyle = '#fff0a1'
        context.fillRect(x - 1, y - 9, 2, 3)
      }
    }

    const x = Math.round(player.x)
    const y = Math.round(player.y)
    context.fillStyle = '#fff3df'
    context.fillRect(x - 4, y - 5, 8, 7)
    context.fillRect(x - 5, y - 3, 10, 3)
    context.fillRect(x - 3, y + 2, 6, 3)
    context.fillStyle = '#211524'
    context.fillRect(x - 3, y - 2, 2, 2)
    context.fillRect(x + 1, y - 2, 2, 2)
    context.fillStyle = '#ff3b66'
    context.fillRect(x - 4, y + 2, 8, 2)
  }
}
