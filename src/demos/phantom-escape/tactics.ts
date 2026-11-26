import { advanceActors, coinsCollected, HIT_DISTANCE, PLAYER_STEP, TICKS_PER_SECOND } from './engine.ts'
import type { Board, Movement, PhantomRun, Sound } from './engine.ts'
import { cellAt, centerOf, distancesFrom, tileDistance } from './map.ts'
import { findRoute } from './path.ts'

const DECISION_TICKS = TICKS_PER_SECOND / 10
const PLAN_TICKS = DECISION_TICKS * 2
const LOOKAHEAD_TICKS = DECISION_TICKS * 3
const RISK_RADIUS = 5
const STALL_TICKS = TICKS_PER_SECOND * 3
const idle: Movement = { x: 0, y: 0 }
const actions: readonly Movement[] = [
  { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 },
  { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 }, idle,
]

export type TacticalPlan = {
  floor: Uint8Array
  intent: 'Collect' | 'Escape'
  evading: boolean
  route: readonly number[]
  explored: ReadonlySet<number>
  risk: Float32Array
}

function enemyRisk(board: Board) {
  const { floor } = board.maze
  const risk = new Float32Array(floor.length)
  for (const enemy of board.enemies) {
    // Include the tile already committed to by the enemy, even while it is moving between tiles.
    const origin = cellAt(enemy.x, enemy.y)
    const current = distancesFrom(floor, origin, RISK_RADIUS)
    const ahead = enemy.next === origin ? current : distancesFrom(floor, enemy.next, RISK_RADIUS)
    for (let cell = 0; cell < risk.length; cell++) {
      const here = current[cell] < 0 ? 0 : (RISK_RADIUS + 1 - current[cell]) ** 2
      const next = ahead[cell] < 0 ? 0 : (RISK_RADIUS + 1 - ahead[cell]) ** 2
      risk[cell] += Math.max(here, .8 * next) * .22
    }
  }
  return risk
}

function makePlan(board: Board, oldPlan: TacticalPlan | undefined, visits: Uint8Array, stalled: boolean): TacticalPlan {
  const { floor, exit } = board.maze
  const start = cellAt(board.player.x, board.player.y)
  const risk = enemyRisk(board)
  // When progress stalls, bias the search away from repeatedly visited tiles.
  const travelCost = stalled ? risk.map((value, cell) => value * .4 + visits[cell] * .65) : risk
  const explored = new Set<number>()
  const escaping = coinsCollected(board) >= board.quota
  if (escaping) {
    return { floor, intent: 'Escape', evading: false, explored, risk,
      route: findRoute(floor, start, exit, travelCost, explored).cells }
  }

  const coins = [...board.coins].sort((a, b) =>
    tileDistance(start, a) + travelCost[a] - tileDistance(start, b) - travelCost[b])
  const targets = new Set(coins.slice(0, 4))
  const previousTarget = oldPlan?.route.at(-1)
  if (previousTarget !== undefined && board.coins.has(previousTarget)) targets.add(previousTarget)
  let best: number[] = []
  let bestCost = Infinity
  for (const target of targets) {
    const route = findRoute(floor, start, target, travelCost, explored)
    // Identical coin values make minimum adjusted cost equivalent to maximum value per cost.
    const cost = route.cost * (target === previousTarget && !stalled ? .85 : 1)
    if (cost < bestCost) {
      best = route.cells
      bestCost = cost
    }
  }
  return { floor, intent: 'Collect', evading: false, route: best, explored, risk }
}

function axis(delta: number): Movement['x'] {
  return Math.abs(delta) < PLAYER_STEP / 2 ? 0 : Math.sign(delta) as Movement['x']
}

function waypoint(board: Board, route: readonly number[]) {
  const cell = cellAt(board.player.x, board.player.y)
  const index = route.indexOf(cell)
  return index < 0 ? cell : (route[index + 1] ?? cell)
}

function followRoute(board: Board, route: readonly number[]): Movement {
  const target = waypoint(board, route)
  const goal = centerOf(target)
  const x = axis(goal.x - board.player.x)
  const y = axis(goal.y - board.player.y)
  // Align with the corridor center before turning into a one-tile passage.
  if (x && y) {
    const current = cellAt(board.player.x, board.player.y)
    const turn = target - current
    if (Math.abs(turn) === 1) return { x: 0, y }
    if (turn) return { x, y: 0 }
  }
  return { x, y }
}

function clearance(board: Board) {
  let closest = Infinity
  for (const enemy of board.enemies) closest = Math.min(closest, Math.hypot(board.player.x - enemy.x, board.player.y - enemy.y))
  return closest
}

function lookAhead(board: Board, route: readonly number[], action?: Movement) {
  const simulated = { ...board, player: { ...board.player }, enemies: board.enemies.map(enemy => ({ ...enemy })) }
  const sounds: Sound[] = []
  let nearest = Infinity
  let distance = clearance(simulated)
  for (let tick = 0; tick < LOOKAHEAD_TICKS; tick++) {
    advanceActors(simulated, action ?? followRoute(simulated, route), sounds)
    distance = clearance(simulated)
    nearest = Math.min(nearest, distance)
    if (distance <= HIT_DISTANCE) break
  }
  return { nearest, distance, end: simulated.player }
}

function findEvasion(board: Board, route: readonly number[]) {
  if (clearance(board) > (PLAYER_STEP + board.enemyStep) * LOOKAHEAD_TICKS + HIT_DISTANCE + 5) return
  const forecast = lookAhead(board, route)
  if (forecast.nearest > HIT_DISTANCE + 5) return
  const goal = centerOf(waypoint(board, route))
  let best: Movement | undefined
  let bestScore = -Infinity
  for (const action of actions) {
    const { nearest, distance, end } = lookAhead(board, route, action)
    const remaining = Math.hypot(goal.x - end.x, goal.y - end.y)
    const collisionPenalty = nearest <= HIT_DISTANCE ? 100 : 0
    const score = Math.min(nearest, 30) * 2 + Math.min(distance, 44) - remaining * .35 - collisionPenalty
    if (score > bestScore) {
      bestScore = score
      best = action
    }
  }
  return best
}

export function createTacticalPlayer() {
  let plan: TacticalPlan | undefined
  let lastPlan = -Infinity
  let lastDecision = -Infinity
  let lastProgress = -Infinity
  let lastCollected = -1
  let lastCell = -1
  let closestToExit = Infinity
  let visits = new Uint8Array(0)
  let exitDistances = new Int16Array(0)
  let evasion: Movement | undefined

  return {
    get plan() { return plan },
    movement(run: PhantomRun): Movement {
      if (run.ended) return idle
      const board = run.board
      // Board time decreases and resets on a new level. A new floor invalidates all controller state.
      const tick = -board.ticksLeft
      const newBoard = plan?.floor !== board.maze.floor
      if (newBoard || tick - lastDecision >= DECISION_TICKS) {
        lastDecision = tick
        if (newBoard) {
          visits = new Uint8Array(board.maze.floor.length)
          exitDistances = distancesFrom(board.maze.floor, board.maze.exit)
          closestToExit = Infinity
          lastCollected = -1
          lastCell = -1
        }
        const cell = cellAt(board.player.x, board.player.y)
        const collected = coinsCollected(board)
        if (collected !== lastCollected || (collected >= board.quota && exitDistances[cell] < closestToExit)) {
          lastProgress = tick
          lastCollected = collected
          visits.fill(0)
          if (collected >= board.quota) closestToExit = Math.min(closestToExit, exitDistances[cell])
        }
        if (cell !== lastCell) {
          visits[cell] = Math.min(visits[cell] + 1, 8)
          lastCell = cell
        }
        const stalled = tick - lastProgress >= STALL_TICKS
        const target = plan?.route.at(-1)
        const targetGone = target !== undefined && target !== board.maze.exit && !board.coins.has(target)
        if (!plan || newBoard || targetGone || tick - lastPlan >= PLAN_TICKS) {
          plan = makePlan(board, newBoard ? undefined : plan, visits, stalled)
          lastPlan = tick
        }
        evasion = findEvasion(board, plan.route)
        plan.evading = evasion !== undefined
      }
      return evasion ?? followRoute(board, plan?.route ?? [])
    },
  }
}
