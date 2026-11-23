// Original sprites. The lighter pixels draw a rib inside the cactus silhouette.
const saguaro = [
  '...#+..',
  '..##+..',
  '..##+..',
  '#.##+..',
  '#.##+.#',
  '#.##+.#',
  '#####.#',
  '.######',
  '..##+..',
  '..##+..',
  '..##+..',
]

const pricklyPear = [
  '....#+.',
  '#+..##+',
  '##+##+.',
  '.####..',
  '..##.##',
  '..####.',
  '..##+..',
]

const organPipe = [
  '...#+..',
  '...#+..',
  '.#.#++.',
  '.#.#+.+',
  '.#.#+.+',
  '.#####.',
  '..##+..',
  '..##+..',
  '..##+..',
]

export const MAX_CACTUS_HEIGHT = Math.max(saguaro.length, pricklyPear.length, organPipe.length)

type CactusPixel = { x: number; y: number; highlight: boolean }
type CactusFormation = { width: number; height: number; pixels: CactusPixel[] }

function formation(...cacti: [x: number, rows: string[]][]): CactusFormation {
  const height = Math.max(...cacti.map(([, rows]) => rows.length))
  const width = Math.max(...cacti.map(([x, rows]) => x + rows[0].length))
  const pixels = cacti.flatMap(([left, rows]) => rows.flatMap((row, y) =>
    [...row].flatMap((pixel, x) => pixel === '.' ? [] : [{
      x: left + x, y: height - rows.length + y, highlight: pixel === '+',
    }]),
  ))
  return { width, height, pixels }
}

export const CACTUS_FORMATIONS = [
  formation([0, saguaro]),
  formation([0, pricklyPear]),
  formation([0, organPipe]),
  formation([0, pricklyPear], [8, saguaro]),
  formation([0, organPipe], [8, pricklyPear]),
  formation([0, pricklyPear], [6, saguaro], [11, organPipe]),
  formation([0, saguaro], [6, organPipe], [11, pricklyPear]),
]
