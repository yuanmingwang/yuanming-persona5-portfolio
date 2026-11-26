import type { PhantomRun } from '../../src/demos/phantom-escape/engine.ts'
import { cellAt, centerOf } from '../../src/demos/phantom-escape/map.ts'
import { createTacticalPlayer } from '../../src/demos/phantom-escape/tactics.ts'
import { ACTIONS } from '../../src/demos/phantom-escape/observations.ts'
import { projectMove } from '../../src/demos/phantom-escape/forecast.ts'

export function createTeacher() {
  const controller = createTacticalPlayer()
  return (run: PhantomRun) => {
    const preferred = controller.movement(run)
    const plan = controller.plan
    if (!plan) return 0

    const board = run.board
    const cell = cellAt(board.player.x, board.player.y)
    const routeIndex = plan.route.indexOf(cell)
    const target = centerOf(routeIndex < 0 ? cell : (plan.route[routeIndex + 1] ?? cell))
    let bestAction = 0
    let bestScore = -Infinity
    for (const [id, action] of ACTIONS.entries()) {
      const { player, clearance, caught } = projectMove(board, action)
      const distance = Math.hypot(player.x - target.x, player.y - target.y)
      const matches = action.x === preferred.x && action.y === preferred.y
      const risk = Math.max(0, 24 - clearance)
      const score = -distance - risk * (plan.evading ? 2 : .7) + Number(matches) * (plan.evading ? 6 : .05)
        - Number(caught) * 1000
      if (score > bestScore) {
        bestAction = id
        bestScore = score
      }
    }
    return bestAction
  }
}
