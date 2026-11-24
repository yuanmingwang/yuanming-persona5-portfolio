import { BIRD_X, GROUND, HEIGHT, PIPE_CAP_HEIGHT, PIPE_CAP_WIDTH, PIPE_INSET, WIDTH } from './flight'
import type { Flight } from './flight'

const bird = [
  '       ######   ',
  '     ##CCCCCC## ',
  '    #CCCCCCCCC# ',
  '   #CCCCCCC#CC##',
  '  #CCCCCCCCCCRR#',
  '###CCCCCCCCCCRR#',
  '#R#CCCCCCCCCCC# ',
  ' ##CCCCCCCCCC#  ',
  '   #CCCCCCCC#   ',
  '    ##CCCC##    ',
  '      ####      ',
]

const wing = [
  ['  ## ', ' #RR#', '#RR# ', ' ##  '],
  [' ### ', '#RRR#', ' ### '],
  [' ##  ', '#RR# ', ' #RR#', '  ## '],
]
const wingFrames = [0, 1, 2, 1]
const buildingHeights = [23, 43, 31, 53, 37, 27, 61, 34]
const ink = { '#': '#110e17', C: '#fff4df', R: '#ed2648' }

export function paintFlight(context: CanvasRenderingContext2D, flight: Flight) {
  function rect(color: string, x: number, y: number, width: number, height: number) {
    context.fillStyle = color
    context.fillRect(x, y, width, height)
  }

  function sprite(rows: readonly string[], x: number, y: number) {
    for (const [row, pixels] of rows.entries()) {
      for (let column = 0; column < pixels.length; column++) {
        const color = ink[pixels[column] as keyof typeof ink]
        if (color) rect(color, x + column * 2, y + row * 2, 2, 2)
      }
    }
  }

  rect('#191521', 0, 0, WIDTH, HEIGHT)
  const moonX = 266 - Math.floor(flight.distance * .018 % 58)
  // Stepped edges keep the moon crisp at the canvas's native resolution.
  for (let y = -27; y <= 27; y += 2) {
    const span = Math.floor(Math.sqrt(28 ** 2 - y ** 2))
    rect(y > 4 && y % 6 === 1 ? '#551d35' : '#ce284a', moonX - span, 62 + y, span * 2, 2)
  }

  const cloudOffset = Math.floor(flight.distance * .14 % 120)
  for (let x = -cloudOffset; x < WIDTH; x += 120) {
    rect('#332332', x + 8, 42, 29, 3)
    rect('#332332', x + 3, 45, 49, 3)
    rect('#4b2a3e', x + 64, 102, 26, 2)
    rect('#402638', x + 48, 104, 55, 4)
  }

  const skylineOffset = Math.floor(flight.distance * .32 % (buildingHeights.length * 19))
  for (let index = 0; index * 19 - skylineOffset < WIDTH; index++) {
    const x = index * 19 - skylineOffset
    const roof = GROUND - buildingHeights[index % buildingHeights.length]
    rect('#2e1c2c', x, roof + 5, 17, GROUND - roof)
    rect('#2e1c2c', x + 3, roof, 11, 5)
    rect('#573044', x + 4, roof + 9, 2, 3)
    rect('#573044', x + 10, roof + 16, 2, 3)
  }

  for (const pipe of flight.pipes) {
    const x = Math.round(pipe.x)
    const top = Math.round(pipe.center - pipe.gap / 2)
    const bottom = Math.round(pipe.center + pipe.gap / 2)
    rect('#100e16', x + PIPE_INSET, 0, PIPE_CAP_WIDTH - 2 * PIPE_INSET, top)
    rect('#100e16', x + PIPE_INSET, bottom, PIPE_CAP_WIDTH - 2 * PIPE_INSET, GROUND - bottom)
    rect('#8d1635', x + 6, 0, PIPE_CAP_WIDTH - 12, top)
    rect('#8d1635', x + 6, bottom, PIPE_CAP_WIDTH - 12, GROUND - bottom)
    rect('#ca2749', x + 9, 0, 4, top)
    rect('#ca2749', x + 9, bottom, 4, GROUND - bottom)
    for (const y of [top - PIPE_CAP_HEIGHT, bottom]) {
      rect('#100e16', x, y, PIPE_CAP_WIDTH, PIPE_CAP_HEIGHT)
      rect('#ed2648', x + 2, y + 1, PIPE_CAP_WIDTH - 4, 4)
      rect('#ff9ba8', x + 3, y + 1, 8, 1)
    }
  }

  rect('#301923', 0, GROUND, WIDTH, HEIGHT - GROUND)
  rect('#ed2648', 0, GROUND, WIDTH, 2)
  const groundOffset = Math.floor(flight.distance % 18)
  for (let x = -groundOffset; x < WIDTH; x += 18) {
    rect('#754053', x, GROUND + 6, 9, 2)
    rect('#523044', x + 9, GROUND + 13, 5, 2)
  }

  const birdY = Math.round(flight.y) - 11
  sprite(bird, BIRD_X - 16, birdY)
  const frame = wingFrames[Math.floor(flight.ticks / 4) % wingFrames.length]
  sprite(wing[frame], BIRD_X - 12, birdY + 8)
}
