import { useEffect, useRef, useState } from 'react'
import { createFlight, TICKS_PER_SECOND } from './flight'
import { captureFrame, FRAME_COUNT, FRAME_SIZE, SAMPLE_TICKS, showFrame } from './frames'
import type { PilotSample } from './pilot'

const FRAME_INTERVAL = SAMPLE_TICKS * 1000 / TICKS_PER_SECOND
const slots = Array.from({ length: FRAME_COUNT }, (_, index) => index)
const pixels = (value?: number | null) => value == null ? '—' : `${Math.round(value)} px`

export default function FlightVision({ sample, aiControls }: { sample: PilotSample | null; aiControls: boolean }) {
  const [readyFrame] = useState(() => captureFrame(createFlight()))
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    for (const [index, canvas] of canvases.current.entries()) {
      if (!canvas) continue
      const frame = sample?.frames[index] ?? (index === 0 ? readyFrame : undefined)
      if (frame) showFrame(canvas, frame)
      else canvas.getContext('2d')?.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
    }
  }, [readyFrame, sample])

  return (
    <aside className="dino-vision" aria-labelledby="flight-vision-title">
      <div className="dino-vision-title">
        <h2 id="flight-vision-title">AI Vision</h2>
        <span>{TICKS_PER_SECOND / SAMPLE_TICKS} Hz</span>
      </div>
      <div className="dino-frames flight-frames">
        {slots.map(index => {
          const label = index === 0 ? 'Current frame' : `${Math.round(index * FRAME_INTERVAL)} ms ago`
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
