import { useEffect, useRef } from 'react'
import { TICKS_PER_SECOND } from './engine'
import { ACTION_LABELS } from './learned'
import type { LearnedDecision } from './learned'
import { TICKS_PER_ACTION } from './observations'
import { VISION_HEIGHT, VISION_WIDTH } from './vision'

export type VisionFrames = { current: Uint8Array; previous?: Uint8Array }

function VisionFrame({ pixels, label }: { pixels?: Uint8Array; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    if (!pixels) {
      context.clearRect(0, 0, VISION_WIDTH, VISION_HEIGHT)
      return
    }

    const image = context.createImageData(VISION_WIDTH, VISION_HEIGHT)
    for (let offset = 0, pixel = 0; offset < pixels.length; offset += 3, pixel += 4) {
      image.data[pixel] = pixels[offset]
      image.data[pixel + 1] = pixels[offset + 1]
      image.data[pixel + 2] = pixels[offset + 2]
      image.data[pixel + 3] = 255
    }
    context.putImageData(image, 0, 0)
  }, [pixels])

  return (
    <figure>
      <canvas ref={canvasRef} width={VISION_WIDTH} height={VISION_HEIGHT}
        role="img" aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

type Props = {
  mode: 'human' | 'ai' | 'state' | 'vision'
  intent: string
  learnedDecision?: LearnedDecision
  planStats: { routeSteps: number; explored: number } | null
  frames: VisionFrames | null
  showPlan: boolean
  onShowPlan: (enabled: boolean) => void
  modelStatus?: string
}

export default function PhantomVision({ mode, intent, learnedDecision, planStats, frames, showPlan, onShowPlan, modelStatus }: Props) {
  const learned = mode === 'state' || mode === 'vision'
  const action = learnedDecision ? ACTION_LABELS[learnedDecision.action] : 'Waiting'
  return (
    <aside className="dino-vision" aria-labelledby="phantom-vision-title">
      <div className="dino-vision-title">
        <h2 id="phantom-vision-title">AI Vision</h2>
        <span>{mode === 'human' ? 'Manual' : `${TICKS_PER_SECOND / TICKS_PER_ACTION} Hz`}</span>
      </div>
      <dl className="dino-readouts">
        <div className="dino-decision">
          <dt>{mode === 'human' ? 'Controls' : mode === 'ai' ? 'AI intent' : 'AI action'}</dt>
          <dd>{mode === 'human' ? 'Human' : mode === 'ai' ? intent || 'Waiting' : action}</dd>
        </div>
        {mode === 'vision' && <div><dt>Input size</dt><dd>{VISION_WIDTH} × {VISION_HEIGHT} RGB</dd></div>}
        {mode === 'state' && <div><dt>Input</dt><dd>Simulator state</dd></div>}
        {learned && <div><dt>Decision time</dt><dd>{learnedDecision ? `${learnedDecision.duration.toFixed(2)} ms` : '—'}</dd></div>}
        {mode === 'ai' && <>
          <div><dt>Planned route</dt><dd>{planStats ? `${planStats.routeSteps} steps` : '—'}</dd></div>
          <div><dt>Explored tiles</dt><dd>{planStats?.explored ?? '—'}</dd></div>
        </>}
      </dl>
      {mode === 'vision' && (
        <div className="dino-frames phantom-frames">
          <VisionFrame label="Current frame" pixels={frames?.current} />
          <VisionFrame label="Previous frame" pixels={frames?.previous} />
        </div>
      )}
      {learned && learnedDecision && (
        <section className="phantom-probabilities" aria-labelledby="phantom-probability-title">
          <h3 id="phantom-probability-title">Top action probabilities</h3>
          <ol>
            {learnedDecision.alternatives.map(({ action: id, probability }) => (
              <li key={id}>
                <span>{ACTION_LABELS[id]}</span>
                <span className="phantom-probability-track" aria-hidden="true">
                  <span style={{ width: `${probability * 100}%` }} />
                </span>
                <strong>{(probability * 100).toFixed(1)}%</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
      {modelStatus && <p className="dino-model-note" role="status">{modelStatus}</p>}
      {mode === 'ai' && (
        <div className="dino-model-note phantom-plan">
          <label><input type="checkbox" checked={showPlan} onChange={event => onShowPlan(event.target.checked)} /> Show AI plan</label>
          {showPlan && <span>Teal path · blue explored tiles · red danger</span>}
        </div>
      )}
      {mode === 'vision' && <p className="dino-model-note">Spatial Vision reads the current RGB frame and HUD.</p>}
      {mode === 'human' && <p className="dino-model-note">Choose an AI mode to see its decisions.</p>}
    </aside>
  )
}
