import { CACTUS_FORMATIONS, MAX_CACTUS_HEIGHT } from './cacti.ts'

export const FRAME_WIDTH = 128
export const FRAME_HEIGHT = 48
export const SAMPLE_TICKS = 4
export const TICKS_PER_SECOND = 60
export const GROUND = 38

const DINO_X = 10
export const DINO_FRONT = DINO_X + 14
const DINO_HEIGHT = 13
const DINO_PIXELS = [
  '        ##### ',
  '       #######',
  '       #### ##',
  '       #######',
  '      ######  ',
  '     #######  ',
  '#   ######    ',
  '## ########   ',
  '#########     ',
  ' #######      ',
  '  #####       ',
  '   ## ##      ',
  '   ## ##      ',
]

const BACKGROUND = 17
const SPAWN_X = FRAME_WIDTH + 5
// Leave enough track to land before the next cluster at top speed.
const MIN_FORMATION_SPACING = 88
export const DINO_SHADE = 145
export const OBSTACLE_SHADE = 220
export const OBSTACLE_HIGHLIGHT = 250

type Obstacle = { x: number; shape: (typeof CACTUS_FORMATIONS)[number] }

export type Runner = {
  obstacles: Obstacle[]
  rise: number
  velocity: number
  ticks: number
  distance: number
  speed: number
  crashed: boolean
}

export function createRunner(): Runner {
  return {
    obstacles: [{ x: 97, shape: CACTUS_FORMATIONS[0] }],
    rise: 0, velocity: 0, ticks: 0, distance: 0, speed: .85, crashed: false,
  }
}

export function jump(run: Runner) {
  if (run.crashed || run.rise > 0 || run.velocity > 0) return false
  run.velocity = 1.95
  return true
}

export function stepRunner(run: Runner, random = Math.random) {
  if (run.crashed) return
  run.ticks++
  run.speed = Math.min(1.45, .85 + run.ticks / 5500)

  if (run.rise > 0 || run.velocity > 0) {
    run.rise = Math.max(0, run.rise + run.velocity)
    run.velocity = run.rise > 0 ? run.velocity - .080 : 0
  }

  for (const obstacle of run.obstacles) {
    obstacle.x -= run.speed
    if (hitsDino(obstacle, run.rise)) run.crashed = true
  }

  run.distance += run.speed
  const lead = run.obstacles[0]
  if (lead && lead.x + lead.shape.width <= 0) run.obstacles.shift()
  const tail = run.obstacles.at(-1)
  if (!tail || tail.x < SPAWN_X - MIN_FORMATION_SPACING) {
    run.obstacles.push({
      x: SPAWN_X + random() * 20,
      shape: CACTUS_FORMATIONS[Math.floor(random() * CACTUS_FORMATIONS.length)],
    })
  }
}

function hitsDino({ x, shape }: Obstacle, rise: number) {
  const left = Math.round(x)
  if (left >= DINO_FRONT || left + shape.width <= DINO_X || rise >= shape.height) return false

  const rowOffset = DINO_HEIGHT + Math.round(rise) - shape.height
  return shape.pixels.some(pixel => DINO_PIXELS[rowOffset + pixel.y]?.[left + pixel.x - DINO_X] === '#')
}

export function drawObservation(pixels: Uint8Array, rise: number, obstacles: readonly Obstacle[]) {
  pixels.fill(BACKGROUND)

  function ink(x: number, y: number, shade: number) {
    if (x >= 0 && x < FRAME_WIDTH && y >= 0 && y < FRAME_HEIGHT) {
      pixels[y * FRAME_WIDTH + x] = shade
    }
  }

  const top = GROUND - DINO_HEIGHT - Math.round(rise)
  for (const [y, row] of DINO_PIXELS.entries()) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') ink(DINO_X + x, top + y, DINO_SHADE)
    }
  }

  for (const obstacle of obstacles) {
    const left = Math.round(obstacle.x)
    const top = GROUND - obstacle.shape.height
    for (const { x, y, highlight } of obstacle.shape.pixels) {
      ink(left + x, top + y, highlight ? OBSTACLE_HIGHLIGHT : OBSTACLE_SHADE)
    }
  }
}

// Scan the whole cactus band so a branch or pad can be the leading edge.
function obstacleEdge(pixels: Uint8Array) {
  for (let x = DINO_FRONT; x < FRAME_WIDTH; x++) {
    for (let y = GROUND - MAX_CACTUS_HEIGHT; y < GROUND; y++) {
      if (pixels[y * FRAME_WIDTH + x] >= OBSTACLE_SHADE) return x
    }
  }
  return null
}

export function readVision(current: Uint8Array, previous: Uint8Array) {
  const edge = obstacleEdge(current)
  const priorEdge = obstacleEdge(previous)
  // Treat an entering, passing, or unmatched obstacle as untracked.
  const shift = edge === null || priorEdge === null ? null : priorEdge - edge
  const speed = shift !== null && shift >= 0 && shift <= 8 ? shift / SAMPLE_TICKS : null
  return { gap: edge === null ? null : edge - DINO_FRONT, speed }
}
