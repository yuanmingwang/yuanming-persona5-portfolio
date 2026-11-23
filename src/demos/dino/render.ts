import {
  DINO_SHADE, FRAME_HEIGHT, FRAME_WIDTH, GROUND, OBSTACLE_HIGHLIGHT, OBSTACLE_SHADE,
} from './runner.ts'

export function paintGame(context: CanvasRenderingContext2D, pixels: Uint8Array, distance: number) {
  context.setTransform(context.canvas.width / FRAME_WIDTH, 0, 0, context.canvas.height / FRAME_HEIGHT, 0, 0)
  context.fillStyle = '#17151e'
  context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)

  context.fillStyle = '#ed2648'
  context.beginPath()
  context.arc(98 - distance * .015 % 24, 18, 10, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#17151e'
  for (let y = 20; y < 28; y += 2) context.fillRect(63, y, 48, .5)

  context.fillStyle = '#33232f'
  const offset = distance * .23 % 32
  for (let x = -32 - offset; x < FRAME_WIDTH; x += 32) {
    context.beginPath()
    context.moveTo(x, GROUND)
    context.lineTo(x + 11, 25)
    context.lineTo(x + 18, 31)
    context.lineTo(x + 24, 29)
    context.lineTo(x + 35, GROUND)
    context.fill()
  }

  context.fillStyle = '#2c1923'
  context.fillRect(0, GROUND, FRAME_WIDTH, FRAME_HEIGHT - GROUND)
  context.fillStyle = '#ff3455'
  context.fillRect(0, GROUND, FRAME_WIDTH, .5)
  context.fillStyle = '#895366'
  for (let x = -(distance % 11); x < FRAME_WIDTH; x += 11) {
    context.fillRect(x, GROUND + 3, 4, .4)
    context.fillRect(x + 6, GROUND + 6, 2, .4)
  }

  for (let index = 0; index < pixels.length; index++) {
    const shade = pixels[index]
    if (shade === DINO_SHADE) context.fillStyle = '#fff4df'
    else if (shade === OBSTACLE_SHADE) context.fillStyle = '#ff4664'
    else if (shade === OBSTACLE_HIGHLIGHT) context.fillStyle = '#ff9eaa'
    else continue
    context.fillRect(index % FRAME_WIDTH, Math.floor(index / FRAME_WIDTH), 1, 1)
  }
}

export function paintObservation(canvas: HTMLCanvasElement | null, pixels: Uint8Array) {
  const context = canvas?.getContext('2d')
  if (!context) return
  const image = context.createImageData(FRAME_WIDTH, FRAME_HEIGHT)
  for (const [index, shade] of pixels.entries()) {
    const offset = index * 4
    image.data[offset] = shade
    image.data[offset + 1] = shade
    image.data[offset + 2] = shade
    image.data[offset + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
