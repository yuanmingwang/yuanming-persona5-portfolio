const palette: Record<string, string> = {
  o: '#0d0b13',
  h: '#28212d',
  e: '#877481',
  m: '#fff5e9',
  s: '#f1bfae',
  c: '#413447',
  r: '#f02143',
  d: '#a9062b',
}

// One logical pixel per cell, with the body centered on column 7 and row 9.
const sprite = [
  '....oo...o........',
  '...oeho.oeo.......',
  '..oehhhhhhho......',
  '.oehhhhhhhhho.....',
  '.ohhehhhehhoo.....',
  '..ohhhhehohho.....',
  '..oomhhohmmoo.....',
  '...omommomso......',
  '....ommmsso.......',
  '....oceorco...oo..',
  '...ocerdrhooorro..',
  '...occomceordrdo..',
  '..orococceooodo...',
  '..odococcco.......',
  '...ocecoceoroo....',
  '..occcoooeeodo....',
  '..ocooo.ooceo.....',
  '...oeo...oeeo.....',
  '...ooo...ooo......',
]

export function paintPlayer(context: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1) {
  const centerX = Math.round(x)
  const centerY = Math.round(y)
  for (const [row, pixels] of sprite.entries()) {
    for (let col = 0; col < pixels.length; col++) {
      const color = palette[pixels[col]]
      if (color === undefined) continue
      context.fillStyle = color
      context.fillRect(centerX + (col - 7) * facing, centerY + row - 9, 1, 1)
    }
  }
}
