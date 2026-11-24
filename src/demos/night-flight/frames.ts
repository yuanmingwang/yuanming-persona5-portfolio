import { HEIGHT, WIDTH } from './flight.ts'
import type { Flight } from './flight.ts'
import { drawFlight } from './render.ts'

export const FRAME_SIZE = 84
export const SAMPLE_TICKS = 2
export const FRAME_COUNT = 4

const xBins = Array.from({ length: WIDTH }, (_, x) => Math.floor(x * FRAME_SIZE / WIDTH))
const yBins = Array.from({ length: HEIGHT }, (_, y) => Math.floor(y * FRAME_SIZE / HEIGHT))
const luminance = new Map<string, number>()

// Use the same drawing commands as the game canvas. Max pooling preserves thin
// pipe highlights and gives training and browser inference identical pixels.
export function captureFrame(flight: Flight) {
  const pixels = new Uint8Array(WIDTH * HEIGHT)
  drawFlight(flight, (color, x, y, width, height) => {
    let gray = luminance.get(color)
    if (gray === undefined) {
      const rgb = Number.parseInt(color.slice(1), 16)
      gray = Math.round(.299 * (rgb >> 16) + .587 * (rgb >> 8 & 255) + .114 * (rgb & 255))
      luminance.set(color, gray)
    }
    const left = Math.max(0, x)
    const right = Math.min(WIDTH, x + width)
    if (left >= right) return
    for (let row = Math.max(0, y); row < Math.min(HEIGHT, y + height); row++) {
      pixels.fill(gray, row * WIDTH + left, row * WIDTH + right)
    }
  })

  const frame = new Uint8Array(FRAME_SIZE ** 2)
  for (let y = 0; y < HEIGHT; y++) {
    const row = yBins[y] * FRAME_SIZE
    for (let x = 0; x < WIDTH; x++) {
      const index = row + xBins[x]
      frame[index] = Math.max(frame[index], pixels[y * WIDTH + x])
    }
  }
  return frame
}

export function showFrame(canvas: HTMLCanvasElement, frame: Uint8Array) {
  const context = canvas.getContext('2d')
  if (!context) return
  const image = context.createImageData(FRAME_SIZE, FRAME_SIZE)
  for (let index = 0; index < frame.length; index++) {
    const offset = index * 4
    image.data.fill(frame[index], offset, offset + 3)
    image.data[offset + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
