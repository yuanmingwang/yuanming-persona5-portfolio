import { useEffect, useRef, useState } from 'react'
import {
  createRunner, drawObservation, FRAME_HEIGHT, FRAME_WIDTH, jump,
  SAMPLE_TICKS, stepRunner, TICKS_PER_SECOND,
} from './runner'
import { paintGame, paintObservation } from './render'
import { JUMP_THRESHOLD, predictJump } from './vision'

type Phase = 'ready' | 'running' | 'paused' | 'crashed'
type Mode = 'human' | 'ai'
type Action = 'Waiting' | 'Tracking' | 'Run' | 'Jump' | 'Airborne' | 'Crash'

const STEP_MS = 1000 / TICKS_PER_SECOND
const percent = (value: number) => `${Math.round(value * 100)}%`
const phaseLabel = { ready: 'Ready to start', running: 'Run in progress', paused: 'Paused', crashed: 'Run over' }

function createSession() {
  const run = createRunner()
  const pixels = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT)
  drawObservation(pixels, run.rise, run.obstacles)
  return { run, pixels, sampled: pixels.slice(), previous: pixels.slice(), jumps: 0 }
}

export default function DinoRunner() {
  const sessionRef = useRef<ReturnType<typeof createSession> | null>(null)
  const modeRef = useRef<Mode>('human')
  const screenRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLCanvasElement>(null)
  const previousRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('human')
  const [phase, setPhase] = useState<Phase>('ready')
  const [runNumber, setRunNumber] = useState(0)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [jumps, setJumps] = useState(0)
  const [vision, setVision] = useState<ReturnType<typeof predictJump> | null>(null)
  const [action, setAction] = useState<Action>('Waiting')

  useEffect(() => {
    const session = createSession()
    sessionRef.current = session
    const screen = screenRef.current?.getContext('2d')
    if (screen) paintGame(screen, session.pixels, 0)
    paintObservation(inputRef.current, session.sampled)
    paintObservation(previousRef.current, session.previous)
  }, [runNumber])

  useEffect(() => {
    const session = sessionRef.current
    const screen = screenRef.current?.getContext('2d')
    if (!session || !screen || phase !== 'running') return
    // Aliases preserve the narrowed types in the animation callback.
    const current = session
    const context = screen
    let frame = 0
    let lastTime: number | undefined
    let elapsed = 0

    function animate(now: number) {
      elapsed += Math.min(now - (lastTime ?? now), 80)
      lastTime = now
      const { run } = current
      while (elapsed >= STEP_MS && !run.crashed) {
        elapsed -= STEP_MS
        stepRunner(run)
        if (run.ticks % SAMPLE_TICKS !== 0) continue

        current.previous.set(current.sampled)
        drawObservation(current.sampled, run.rise, run.obstacles)
        const prediction = predictJump(current.sampled, current.previous)
        const shouldJump = prediction.probability !== null && prediction.probability >= JUMP_THRESHOLD
        let decision: Action = prediction.probability === null ? 'Tracking' : 'Run'
        if (run.rise > 0 || run.velocity > 0) decision = 'Airborne'
        else if (shouldJump) {
          decision = 'Jump'
          if (modeRef.current === 'ai' && jump(run)) {
            current.jumps++
            setJumps(current.jumps)
          }
        }
        setVision(prediction)
        setAction(decision)
        setScore(Math.floor(run.distance))
        paintObservation(inputRef.current, current.sampled)
        paintObservation(previousRef.current, current.previous)
      }

      drawObservation(current.pixels, run.rise, run.obstacles)
      paintGame(context, current.pixels, run.distance)

      if (run.crashed) {
        const distance = Math.floor(run.distance)
        setScore(distance)
        setBest(value => Math.max(distance, value))
        setAction('Crash')
        setPhase('crashed')
        return
      }
      frame = requestAnimationFrame(animate)
    }

    function pauseInBackground() {
      if (document.hidden) setPhase('paused')
    }

    frame = requestAnimationFrame(animate)
    document.addEventListener('visibilitychange', pauseInBackground)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', pauseInBackground)
    }
  }, [phase, runNumber])

  function selectMode(next: Mode) {
    modeRef.current = next
    setMode(next)
    if (next === 'human' && phase === 'running') {
      screenRef.current?.focus({ preventScroll: true })
    }
  }

  function startOrPause() {
    if (phase === 'running') {
      setPhase('paused')
      return
    }
    if (phase === 'crashed') resetRun('running')
    else setPhase('running')
    screenRef.current?.focus({ preventScroll: true })
  }

  function resetRun(next: Phase = 'ready') {
    setRunNumber(value => value + 1)
    setPhase(next)
    setScore(0)
    setJumps(0)
    setVision(null)
    setAction('Waiting')
  }

  function jumpAsHuman() {
    const session = sessionRef.current
    if (phase !== 'running' || mode !== 'human' || !session || !jump(session.run)) return
    session.jumps++
    setJumps(session.jumps)
  }

  const playLabel = { ready: 'Start run', running: 'Pause', paused: 'Resume', crashed: 'Play again' }

  return (
    <div className="dino-workspace">
      <section className="dino-game" aria-labelledby="dino-game-title">
        <div className="dino-game-header">
          <h2 id="dino-game-title">Dino Runner</h2>
          <div className="dino-header-controls">
            <div className="dino-mode" role="group" aria-label="Who controls the runner">
              <button type="button" aria-pressed={mode === 'human'} onClick={() => selectMode('human')}>
                <span className="dino-mode-star" aria-hidden="true">★</span>Human
              </button>
              <button type="button" aria-pressed={mode === 'ai'} onClick={() => selectMode('ai')}>
                <span className="dino-mode-star" aria-hidden="true">★</span>AI
              </button>
            </div>
            <div className="dino-controls">
              <button type="button" className="dino-primary" onClick={startOrPause}>{playLabel[phase]}</button>
              <button type="button" disabled={phase === 'ready'} onClick={() => {
                setBest(value => Math.max(value, score))
                resetRun()
              }}>Reset</button>
              <button type="button" disabled={phase !== 'running' || mode !== 'human'} onClick={jumpAsHuman}>Jump</button>
            </div>
          </div>
        </div>

        <div className="dino-screen">
          <canvas
            ref={screenRef}
            width={768}
            height={288}
            tabIndex={0}
            aria-label="Dino Runner game screen"
            aria-describedby="dino-help"
            onKeyDown={event => {
              if (event.key === 'Escape' && phase === 'running') {
                event.preventDefault()
                setPhase('paused')
              } else if (event.key === ' ' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (!event.repeat) jumpAsHuman()
              }
            }}
            onPointerDown={event => {
              if (event.button === 0) jumpAsHuman()
            }}
          />
          {phase !== 'running' && (
            <div className="dino-screen-status" aria-hidden="true">{phaseLabel[phase]}</div>
          )}
        </div>

        <div className="dino-game-footer">
          <dl className="dino-score">
            <div><dt>Score</dt><dd>{score}</dd></div>
            <div><dt>Best</dt><dd>{Math.max(best, score)}</dd></div>
            <div><dt>Jumps</dt><dd>{jumps}</dd></div>
          </dl>
        </div>
        <p id="dino-help" className="dino-help">
          {mode === 'human'
            ? 'Press Space or ↑ to jump. You can also tap the game screen. Press Esc to pause.'
            : 'The AI jumps automatically. Switch to Human at any time to take over.'}
        </p>
        <span className="arcade-visually-hidden" role="status">{phaseLabel[phase]}</span>
      </section>

      <aside className="dino-vision" aria-labelledby="dino-vision-title">
        <div className="dino-vision-title">
          <h2 id="dino-vision-title">AI Vision</h2>
          <span>{TICKS_PER_SECOND / SAMPLE_TICKS} Hz</span>
        </div>
        <div className="dino-frames">
          <figure>
            <canvas ref={inputRef} width={FRAME_WIDTH} height={FRAME_HEIGHT}
              aria-label="Current grayscale frame showing the runner and track obstacles" role="img" />
            <figcaption>Current frame</figcaption>
          </figure>
          <figure>
            <canvas ref={previousRef} width={FRAME_WIDTH} height={FRAME_HEIGHT}
              aria-label="Previous grayscale frame" role="img" />
            <figcaption>Previous frame</figcaption>
          </figure>
        </div>

        <dl className="dino-readouts">
          <div className="dino-decision">
            <dt>{mode === 'ai' ? 'AI action' : 'AI recommendation'}</dt>
            <dd>{action}</dd>
          </div>
          <div><dt>Jump probability</dt><dd>{vision?.probability == null ? '—' : percent(vision.probability)}</dd></div>
          <div><dt>Jump threshold</dt><dd>{percent(JUMP_THRESHOLD)}</dd></div>
          <div><dt>Obstacle gap</dt><dd>{vision?.gap == null ? '—' : `${vision.gap} px`}</dd></div>
          <div><dt>Closing speed</dt><dd>{vision?.speed == null ? '—' : `${Math.round(vision.speed * TICKS_PER_SECOND)} px/s`}</dd></div>
        </dl>

        <p className="dino-model-note">
          A locally trained classifier reads two {FRAME_WIDTH} × {FRAME_HEIGHT} grayscale frames. It estimates obstacle distance and closing speed from their pixels.
        </p>
      </aside>
    </div>
  )
}
