export const COLUMNS = 40
export const ROWS = 24
export const TILE = 16
export const WIDTH = COLUMNS * TILE
export const HEIGHT = ROWS * TILE

const ROOM_COLUMNS = 4
const ROOM_ROWS = 3
const MIN_ENEMY_DISTANCE = 12

export const MAP_LABELS = {
  rooms: 'Room dungeon',
  arena: 'Open arena',
  hybrid: 'Hybrid dungeon',
  labyrinth: 'Labyrinth',
} as const

export type MapFamily = keyof typeof MAP_LABELS
const EARLY_MAPS: readonly MapFamily[] = ['rooms', 'arena']
const MID_MAPS: readonly MapFamily[] = [...EARLY_MAPS, 'hybrid']
const LATE_MAPS: readonly MapFamily[] = [...MID_MAPS, 'labyrinth']

export type Maze = {
  family: MapFamily
  floor: Uint8Array
  start: number
  exit: number
  coins: number[]
  enemies: number[]
}

export function cellAt(x: number, y: number) {
  return Math.floor(y / TILE) * COLUMNS + Math.floor(x / TILE)
}

export function centerOf(cell: number) {
  return { x: (cell % COLUMNS + .5) * TILE, y: (Math.floor(cell / COLUMNS) + .5) * TILE }
}

export function tileDistance(a: number, b: number) {
  return Math.abs(a % COLUMNS - b % COLUMNS) + Math.abs(Math.floor(a / COLUMNS) - Math.floor(b / COLUMNS))
}

export function floorNeighbors(floor: Uint8Array, cell: number) {
  // A permanent wall border keeps floor cells away from row and array edges.
  return [cell - COLUMNS, cell + 1, cell + COLUMNS, cell - 1].filter(next => floor[next] === 1)
}

export function distancesFrom(floor: Uint8Array, origin: number, limit = Infinity) {
  const distance = new Int16Array(floor.length).fill(-1)
  const queue = [origin]
  distance[origin] = 0
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    if (distance[cell] >= limit) continue
    for (const next of floorNeighbors(floor, cell)) {
      if (distance[next] !== -1) continue
      distance[next] = distance[cell] + 1
      queue.push(next)
    }
  }
  return distance
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return (count: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return Math.floor(state / 2 ** 32 * count)
  }
}

export function levelRules(level: number) {
  const coins = Math.min(40, 18 + 2 * level)
  return {
    coins,
    quota: Math.ceil(coins * .6),
    enemies: Math.min(8, 2 + Math.floor((level - 1) / 2)),
    seconds: Math.min(90, 60 + 5 * (level - 1)),
    enemySpeed: Math.min(.9, .55 + .05 * (level - 1)),
    mapPool: level >= 7 ? LATE_MAPS : level >= 4 ? MID_MAPS : EARLY_MAPS,
  }
}

type Random = ReturnType<typeof seededRandom>

function carveRooms(floor: Uint8Array, random: Random, hybrid: boolean) {
  const rooms: { x: number; y: number }[] = []

  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLUMNS; col++) {
      const left = col * 10 + 1 + random(3)
      const top = row * 8 + 1 + random(2)
      const width = Math.min((hybrid ? 7 : 5) + random(3), COLUMNS - 1 - left)
      const height = Math.min((hybrid ? 5 : 4) + random(2), ROWS - 1 - top)
      for (let y = top; y < top + height; y++) {
        floor.fill(1, y * COLUMNS + left, y * COLUMNS + left + width)
      }
      const room = { x: left + Math.floor(width / 2), y: top + Math.floor(height / 2) }
      const above = row > 0 ? rooms[rooms.length - ROOM_COLUMNS] : undefined
      const west = col > 0 ? rooms[rooms.length - 1] : undefined
      // Every room connects to an earlier room. Optional links make some routes loop.
      const connectWest = west && (!above || random(2) === 0)
      if (west && (connectWest || random(3) === 0)) {
        floor.fill(1, west.y * COLUMNS + west.x, west.y * COLUMNS + room.x + 1)
        for (let y = Math.min(west.y, room.y); y <= Math.max(west.y, room.y); y++) {
          floor[y * COLUMNS + room.x] = 1
        }
      }
      if (above && (!connectWest || random(3) === 0)) {
        for (let y = above.y; y <= room.y; y++) floor[y * COLUMNS + above.x] = 1
        floor.fill(1, room.y * COLUMNS + Math.min(above.x, room.x), room.y * COLUMNS + Math.max(above.x, room.x) + 1)
      }
      rooms.push(room)
    }
  }

  const startRoom = rooms[random(rooms.length)]
  return startRoom.y * COLUMNS + startRoom.x
}

function carveArena(floor: Uint8Array, random: Random) {
  for (let row = 1; row < ROWS - 1; row++) floor.fill(1, row * COLUMNS + 1, (row + 1) * COLUMNS - 1)
  // The spaces between obstacle slots form continuous lanes around every obstacle.
  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLUMNS; col++) {
      if (random(4) === 0) continue
      const left = col * 10 + 2 + random(2)
      const top = row * 7 + 3 + random(2)
      const width = 2 + random(4)
      const height = 2 + random(3)
      for (let y = top; y < top + height; y++) floor.fill(0, y * COLUMNS + left, y * COLUMNS + left + width)
    }
  }
  const corners = [COLUMNS + 1, COLUMNS * 2 - 2, (ROWS - 2) * COLUMNS + 1, (ROWS - 1) * COLUMNS - 2]
  return corners[random(corners.length)]
}

function carveLabyrinth(floor: Uint8Array, random: Random) {
  const start = (2 * random(Math.floor((ROWS - 1) / 2)) + 1) * COLUMNS +
    2 * random(Math.floor((COLUMNS - 1) / 2)) + 1
  const stack = [start]
  floor[start] = 1
  while (stack.length) {
    const cell = stack[stack.length - 1]
    const x = cell % COLUMNS
    const y = Math.floor(cell / COLUMNS)
    const steps = []
    if (x > 1) steps.push(-1)
    if (x < COLUMNS - 3) steps.push(1)
    if (y > 1) steps.push(-COLUMNS)
    if (y < ROWS - 3) steps.push(COLUMNS)
    const unvisited = steps.filter(step => !floor[cell + 2 * step])
    if (!unvisited.length) {
      stack.pop()
      continue
    }
    const step = unvisited[random(unvisited.length)]
    floor[cell + step] = 1
    floor[cell + 2 * step] = 1
    stack.push(cell + 2 * step)
  }
  // Open selected links between junctions to create alternate routes around enemies.
  for (let y = 1; y < ROWS - 2; y++) {
    for (let x = 1; x < COLUMNS - 2; x++) {
      const cell = y * COLUMNS + x
      if ((x % 2) !== (y % 2) && !floor[cell] && random(3) === 0) floor[cell] = 1
    }
  }
  return start
}

export function generateMaze(seed: number, level: number): Maze {
  const rules = levelRules(level)
  // Keep family selection independent of the random stream used to carve and populate the board.
  const family = rules.mapPool[((seed ^ Math.imul(level - 1, 0x9e3779b9)) >>> 0) % rules.mapPool.length]
  const random = seededRandom(seed ^ Math.imul(level, 0x9e3779b9))
  const floor = new Uint8Array(ROWS * COLUMNS)
  const start = family === 'arena' ? carveArena(floor, random)
    : family === 'labyrinth' ? carveLabyrinth(floor, random)
    : carveRooms(floor, random, family === 'hybrid')
  const distances = distancesFrom(floor, start)
  let exit = start
  const candidates: number[] = []
  for (let cell = 0; cell < distances.length; cell++) {
    if (distances[cell] > distances[exit]) exit = cell
    if (distances[cell] > 0) candidates.push(cell)
  }

  for (let index = candidates.length - 1; index > 0; index--) {
    const other = random(index + 1)
    const cell = candidates[index]
    candidates[index] = candidates[other]
    candidates[other] = cell
  }

  const enemies = candidates.filter(cell => cell !== exit && distances[cell] >= MIN_ENEMY_DISTANCE).slice(0, rules.enemies)
  const coins = candidates.filter(cell => cell !== exit && !enemies.includes(cell)).slice(0, rules.coins)
  return { family, floor, start, exit, coins, enemies }
}
