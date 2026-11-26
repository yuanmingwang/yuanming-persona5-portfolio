import { cellAt, centerOf, distancesFrom, floorNeighbors, generateMaze, levelRules, TILE } from './map.ts'

export const TICKS_PER_SECOND = 60
export const PLAYER_STEP = 96 / TICKS_PER_SECOND
export const HIT_DISTANCE = 10
const PLAYER_RADIUS = 5
const CHASE_RANGE = 7
const COIN_POINTS = 100
const CLEAR_POINTS = 500
const PERFECT_POINTS = 200

type Point = ReturnType<typeof centerOf>
type Axis = -1 | 0 | 1
export type Movement = { x: Axis; y: Axis }
export type Sound = 'coin' | 'unlock_exit' | 'alert_enemy_detect_player' | 'death' |
  'level_clear' | 'level_clear_perfect' | 'warning_countdown_begin' | 'warning_countdown'

function createLevel(seed: number, number: number) {
  const maze = generateMaze(seed, number)
  const rules = levelRules(number)
  return {
    maze,
    player: centerOf(maze.start),
    coins: new Set(maze.coins),
    enemies: maze.enemies.map((cell, index) => ({
      ...centerOf(cell),
      cell,
      next: cell,
      previous: -1,
      kind: index % 2 === 1 ? 'chaser' as const : 'patroller' as const,
      chasing: false,
    })),
    quota: rules.quota,
    ticksLeft: rules.seconds * TICKS_PER_SECOND,
    enemyStep: PLAYER_STEP * rules.enemySpeed,
  }
}

export function createRun(seed: number) {
  const runSeed = seed >>> 0
  return {
    seed: runSeed,
    level: 1,
    score: 0,
    ended: null as 'caught' | 'timeout' | null,
    board: createLevel(runSeed, 1),
  }
}

export type PhantomRun = ReturnType<typeof createRun>
export type Board = PhantomRun['board']

export function coinsCollected(board: Board) {
  return board.maze.coins.length - board.coins.size
}

function canOccupy(floor: Uint8Array, x: number, y: number) {
  return floor[cellAt(x - PLAYER_RADIUS, y - PLAYER_RADIUS)] === 1 &&
    floor[cellAt(x + PLAYER_RADIUS, y - PLAYER_RADIUS)] === 1 &&
    floor[cellAt(x - PLAYER_RADIUS, y + PLAYER_RADIUS)] === 1 &&
    floor[cellAt(x + PLAYER_RADIUS, y + PLAYER_RADIUS)] === 1
}

function movePlayer(board: Board, movement: Movement) {
  const { player, maze } = board
  const step = movement.x && movement.y ? PLAYER_STEP * Math.SQRT1_2 : PLAYER_STEP
  const x = player.x + movement.x * step
  const y = player.y + movement.y * step
  // Resolve one axis at a time to allow wall sliding without crossing blocked corners.
  if (canOccupy(maze.floor, x, player.y)) player.x = x
  if (canOccupy(maze.floor, player.x, y)) player.y = y
}

function moveEnemies(board: Board, playerCell: number, sounds: Sound[]) {
  const { maze, player } = board
  let distances: Int16Array | undefined

  for (const [index, enemy] of board.enemies.entries()) {
    if (enemy.cell === enemy.next) {
      let target: number | undefined
      const close = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y) <= (CHASE_RANGE + 1) * TILE
      if (enemy.kind === 'chaser' && close) {
        const chaseDistances = distances ??= distancesFrom(maze.floor, playerCell, CHASE_RANGE)
        const distance = chaseDistances[enemy.cell]
        if (distance > 0) {
          target = floorNeighbors(maze.floor, enemy.cell).find(next => chaseDistances[next] === distance - 1)
        }
      }
      if (target !== undefined && !enemy.chasing && !sounds.includes('alert_enemy_detect_player')) {
        sounds.push('alert_enemy_detect_player')
      }
      enemy.chasing = target !== undefined

      if (target === undefined) {
        const neighbors = floorNeighbors(maze.floor, enemy.cell)
        const forward = neighbors.filter(cell => cell !== enemy.previous)
        target = forward[(enemy.cell + index) % forward.length] ?? neighbors[0]
      }
      enemy.next = target
    }

    const goal = centerOf(enemy.next)
    const distance = Math.abs(goal.x - enemy.x) + Math.abs(goal.y - enemy.y)
    if (distance <= board.enemyStep) {
      enemy.x = goal.x
      enemy.y = goal.y
      enemy.previous = enemy.cell
      enemy.cell = enemy.next
    } else {
      enemy.x += Math.sign(goal.x - enemy.x) * board.enemyStep
      enemy.y += Math.sign(goal.y - enemy.y) * board.enemyStep
    }
  }
}

function near(a: Point, b: Point, radius: number) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius ** 2
}

export function advanceActors(board: Board, movement: Movement, sounds: Sound[]) {
  movePlayer(board, movement)
  const cell = cellAt(board.player.x, board.player.y)
  moveEnemies(board, cell, sounds)
  return cell
}

export function stepRun(run: PhantomRun, movement: Movement): Sound[] {
  const sounds: Sound[] = []
  if (run.ended) return sounds

  const board = run.board
  board.ticksLeft--
  if (board.ticksLeft === 0) {
    run.ended = 'timeout'
    return ['death']
  }

  const cell = advanceActors(board, movement, sounds)
  if (board.enemies.some(enemy => near(enemy, board.player, HIT_DISTANCE))) {
    run.ended = 'caught'
    return ['death']
  }

  if (board.coins.has(cell) && near(board.player, centerOf(cell), 8)) {
    board.coins.delete(cell)
    run.score += COIN_POINTS
    sounds.push('coin')
    if (coinsCollected(board) === board.quota) sounds.push('unlock_exit')
  }

  if (cell === board.maze.exit && near(board.player, centerOf(cell), 8) && coinsCollected(board) >= board.quota) {
    const perfect = board.coins.size === 0
    run.score += CLEAR_POINTS + (perfect ? PERFECT_POINTS : 0)
    run.level++
    run.board = createLevel(run.seed, run.level)
    return [perfect ? 'level_clear_perfect' : 'level_clear']
  }

  if (board.ticksLeft === 10 * TICKS_PER_SECOND) sounds.push('warning_countdown_begin')
  else if (board.ticksLeft < 10 * TICKS_PER_SECOND && board.ticksLeft % TICKS_PER_SECOND === 0) {
    sounds.push('warning_countdown')
  }
  return sounds
}
