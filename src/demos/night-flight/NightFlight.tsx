import { useEffect, useRef, useState } from 'react'
import { createArcadeAudio } from '../audio'
import { createFlight, flap, HEIGHT, stepFlight, TICKS_PER_SECOND, WIDTH } from './flight'
import { paintFlight } from './render'

type Phase = 'ready' | 'running' | 'paused' | 'crashed'
const STEP_MS = 1000 / TICKS_PER_SECOND
const screenLabel = { ready: 'Ready to fly', running: 'Flight in progress', paused: 'Paused', crashed: 'Flight over' }
const playLabel = { ready: 'Start flight', running: 'Pause', paused: 'Resume', crashed: 'Play again' }

export default function NightFlight() {
  const flightRef = useRef<ReturnType<typeof createFlight> | null>(null)
  const screenRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<ReturnType<typeof createArcadeAudio> | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [effectsEnabled, setEffectsEnabled] = useState(true)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)

  useEffect(() => {
    const flight = createFlight()
    flightRef.current = flight
    const context = screenRef.current?.getContext('2d')
    if (context) paintFlight(context, flight)

    return () => {
      audioRef.current?.close()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const screen = screenRef.current?.getContext('2d')
    const currentFlight = flightRef.current
    if (phase !== 'running' || !screen || !currentFlight) return
    const context = screen
    const flight = currentFlight

    let frame = 0
    let previousTime: number | undefined
    let accumulated = 0
    function animate(now: number) {
      accumulated += Math.min(now - (previousTime ?? now), 80)
      previousTime = now
      const previousScore = flight.score

      while (accumulated >= STEP_MS && !flight.crashed) {
        accumulated -= STEP_MS
        stepFlight(flight)
      }

      if (flight.score > previousScore) {
        setScore(flight.score)
        setBest(best => Math.max(best, flight.score))
        audioRef.current?.play('point')
      }
      paintFlight(context, flight)

      if (flight.crashed) {
        audioRef.current?.play('die')
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
  }, [phase])

  function configureAudio(enabled: boolean) {
    if (enabled && !audioRef.current && typeof AudioContext !== 'undefined') {
      audioRef.current = createArcadeAudio()
    }
    audioRef.current?.enable(enabled)
  }

  function resetFlight() {
    const flight = createFlight()
    flightRef.current = flight
    setScore(0)
    const context = screenRef.current?.getContext('2d')
    if (context) paintFlight(context, flight)
    return flight
  }

  function flapAsHuman() {
    const flight = phase === 'crashed' ? resetFlight() : flightRef.current
    if (phase === 'paused' || !flight || flight.crashed) return
    if (phase !== 'running') {
      configureAudio(effectsEnabled)
      screenRef.current?.scrollIntoView({ block: 'nearest' })
      setPhase('running')
    }
    flap(flight)
    audioRef.current?.play('jump')
  }

  function startOrPause() {
    if (phase === 'running') {
      setPhase('paused')
      return
    }
    if (phase === 'paused') setPhase('running')
    else flapAsHuman()
    screenRef.current?.focus({ preventScroll: true })
  }

  return (
    <section className="arcade-game night-flight" aria-labelledby="night-flight-title">
      <div className="arcade-game-header">
        <h2 id="night-flight-title">Night Flight</h2>
        <div className="arcade-header-controls arcade-controls">
          <button type="button" className="arcade-primary" onClick={startOrPause}>{playLabel[phase]}</button>
          <button type="button" onClick={() => {
            resetFlight()
            setPhase('ready')
            screenRef.current?.focus({ preventScroll: true })
          }} disabled={phase === 'ready'}>Reset</button>
          <button type="button" onClick={() => {
            flapAsHuman()
            screenRef.current?.focus({ preventScroll: true })
          }} disabled={phase !== 'running'}>Flap</button>
        </div>
      </div>

      <div className="arcade-screen">
        <canvas ref={screenRef} width={WIDTH} height={HEIGHT} tabIndex={0}
          aria-label="Night Flight game screen" aria-describedby="night-flight-help"
          onKeyDown={event => {
            if (event.key === 'Escape' && phase === 'running') {
              event.preventDefault()
              setPhase('paused')
            } else if (event.key === ' ' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!event.repeat) flapAsHuman()
            }
          }}
          onPointerDown={event => {
            if (event.button === 0 && event.isPrimary) {
              screenRef.current?.focus({ preventScroll: true })
              flapAsHuman()
            }
          }}
        />
        {phase !== 'running' && <div className="arcade-screen-status" aria-hidden="true">{screenLabel[phase]}</div>}
      </div>

      <div className="arcade-game-footer">
        <dl className="arcade-score">
          <div><dt>Pipes passed</dt><dd>{score}</dd></div>
          <div><dt>Best</dt><dd>{best}</dd></div>
        </dl>
        <button type="button" className="utility-button arcade-sfx" aria-label="Game sound effects"
          aria-pressed={effectsEnabled} onClick={() => {
            configureAudio(!effectsEnabled)
            setEffectsEnabled(!effectsEnabled)
          }}>
          SFX {effectsEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <p id="night-flight-help" className="arcade-help">
        Press Space or ↑, or tap the screen to flap through the pipes. Press Esc to pause.
      </p>
      <span className="arcade-visually-hidden" role="status">{screenLabel[phase]}</span>
    </section>
  )
}
