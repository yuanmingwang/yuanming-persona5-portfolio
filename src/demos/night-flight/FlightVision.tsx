import { useEffect, useRef, useState } from 'react'
import { createFlight, TICKS_PER_SECOND } from './flight'
import { captureFrame, FRAME_COUNT, FRAME_SIZE, SAMPLE_TICKS, showFrame } from './frames'
import type { PilotSample } from './pilot'
import { PixelClass, readFrame } from './vision'

const FRAME_INTERVAL = SAMPLE_TICKS * 1000 / TICKS_PER_SECOND
const historySlots = Array.from({ length: FRAME_COUNT - 1 }, (_, index) => index + 1)
const palette = {
  [PixelClass.Background]: { name: 'Background', rgb: [25, 21, 33] },
  [PixelClass.Bird]: { name: 'Bird', rgb: [255, 244, 223] },
  [PixelClass.PipeCap]: { name: 'Pipe cap', rgb: [255, 77, 112] },
}

function showClassMap(canvas: HTMLCanvasElement, classMap: Uint8Array) {
  const context = canvas.getContext('2d')
  if (!context) return
  const image = context.createImageData(FRAME_SIZE, FRAME_SIZE)
  for (const [index, category] of classMap.entries()) {
    image.data.set(palette[category as keyof typeof palette].rgb, index * 4)
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
const pixels = (value?: number | null) => value == null ? '—' : `${Math.round(value)} px`

export default function FlightVision({ sample, aiControls }: { sample: PilotSample | null; aiControls: boolean }) {
  const [ready] = useState(() => {
    const frame = captureFrame(createFlight())
    return { frame, classMap: readFrame(frame).classMap }
  })
  const maskRef = useRef<HTMLCanvasElement>(null)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    for (const [index, canvas] of canvases.current.entries()) {
      if (!canvas) continue
      const frame = sample?.frames[index] ?? (index === 0 ? ready.frame : undefined)
      if (frame) showFrame(canvas, frame)
      else canvas.getContext('2d')?.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
    }
    const mask = maskRef.current
    if (mask) showClassMap(mask, sample?.classMap ?? ready.classMap)
  }, [ready, sample])

  return (
    <aside className="dino-vision" aria-labelledby="flight-vision-title">
      <div className="dino-vision-title">
        <h2 id="flight-vision-title">AI Vision</h2>
        <span>{TICKS_PER_SECOND / SAMPLE_TICKS} Hz</span>
      </div>
      <div className="dino-frames flight-frames">
        <figure className="flight-primary-frame">
          <canvas ref={canvas => { canvases.current[0] = canvas }} width={FRAME_SIZE}
            height={FRAME_SIZE} role="img" aria-label="Current grayscale input frame" />
          <figcaption>Current frame</figcaption>
        </figure>
        <figure className="flight-primary-frame">
          <canvas ref={maskRef} width={FRAME_SIZE} height={FRAME_SIZE}
            role="img" aria-label="CNN output for the current frame, colored by predicted pixel class" />
          <figcaption>CNN output</figcaption>
        </figure>
        <ul className="flight-class-legend" aria-label="Pixel class colors">
          {Object.values(palette).map(({ name, rgb }) => (
            <li key={name}>
              <span aria-hidden="true" style={{ backgroundColor: `rgb(${rgb.join(' ')})` }} />
              {name}
            </li>
          ))}
        </ul>
        {historySlots.map(index => {
          const label = `${Math.round(index * FRAME_INTERVAL)} ms ago`
          return (
            <figure key={index}>
              <canvas ref={canvas => { canvases.current[index] = canvas }} width={FRAME_SIZE}
                height={FRAME_SIZE} role="img" aria-label={label} />
              <figcaption>{label}</figcaption>
            </figure>
          )
        })}
      </div>
      <dl className="dino-readouts">
        <div className="dino-decision"><dt>{aiControls ? 'AI action' : 'AI recommendation'}</dt><dd>{sample ? sample.flap ? 'Flap' : 'Glide' : 'Waiting'}</dd></div>
        <div><dt>Bird height from top</dt><dd>{pixels(sample?.birdY)}</dd></div>
        <div><dt>Gap height from top</dt><dd>{pixels(sample?.gapY)}</dd></div>
        <div><dt>Decision time</dt><dd>{sample ? `${sample.duration.toFixed(1)} ms` : '—'}</dd></div>
      </dl>
      <p className="dino-model-note">
        A trained CNN locates the bird and pipe gaps in {FRAME_SIZE} × {FRAME_SIZE} grayscale frames.
        A flight controller uses those estimates to choose when to flap.
      </p>
    </aside>
  )
}
