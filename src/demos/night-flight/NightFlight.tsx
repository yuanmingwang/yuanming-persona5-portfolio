import { useEffect, useRef, useState } from 'react'
import { createArcadeAudio } from '../audio'
import { createFlight, flap, HEIGHT, stepFlight, TICKS_PER_SECOND, WIDTH } from './flight'
import type { Flight } from './flight'
import { paintFlight } from './render'
import { SAMPLE_TICKS } from './frames'
import { createPilot } from './pilot'
import type { PilotSample } from './pilot'
import FlightVision from './FlightVision'

type Mode = 'human' | 'ai'
type Phase = 'ready' | 'running' | 'paused' | 'crashed'
const STEP_MS = 1000 / TICKS_PER_SECOND
const screenLabel = { ready: 'Ready to fly', running: 'Flight in progress', paused: 'Paused', crashed: 'Flight over' }
const playLabel = { ready: 'Start flight', running: 'Pause', paused: 'Resume', crashed: 'Play again' }

export default function NightFlight() {
  const flightRef = useRef<ReturnType<typeof createFlight> | null>(null)
  const pilotRef = useRef<ReturnType<typeof createPilot> | null>(null)
  const screenRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<ReturnType<typeof createArcadeAudio> | null>(null)
  const [mode, setMode] = useState<Mode>('human')
  const [sample, setSample] = useState<PilotSample | null>(null)
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
        if (flight.ticks % SAMPLE_TICKS === 0) {
          const pilot = pilotRef.current ??= createPilot()
          const observation = pilot.sample(flight)
          if (mode === 'ai' && observation.flap) {
            pilot.recordFlap(flight.ticks)
            flap(flight)
            audioRef.current?.play('jump')
          }
          setSample(observation)
        }
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
  }, [mode, phase])

  function configureAudio(enabled: boolean) {
    if (enabled && !audioRef.current && typeof AudioContext !== 'undefined') {
      audioRef.current = createArcadeAudio()
    }
    audioRef.current?.enable(enabled)
  }

  function resetFlight() {
    const flight = createFlight()
    flightRef.current = flight
    pilotRef.current = null
    setSample(null)
    setScore(0)
    const context = screenRef.current?.getContext('2d')
    if (context) paintFlight(context, flight)
    return flight
  }

  function applyHumanFlap(flight: Flight) {
    const pilot = pilotRef.current ??= createPilot()
    pilot.recordFlap(flight.ticks)
    flap(flight)
    audioRef.current?.play('jump')
  }

  function beginFlight() {
    const flight = phase === 'crashed' ? resetFlight() : flightRef.current
    if (!flight) return
    configureAudio(effectsEnabled)
    screenRef.current?.scrollIntoView({ block: 'nearest' })
    setPhase('running')
    if (mode === 'human') applyHumanFlap(flight)
  }

  function flapAsHuman() {
    if (mode !== 'human' || phase === 'paused') return
    if (phase !== 'running') {
      beginFlight()
      return
    }
    const flight = flightRef.current
    if (!flight || flight.crashed) return
    applyHumanFlap(flight)
  }

  function selectMode(next: Mode) {
    if (mode === next) return
    setMode(next)
    screenRef.current?.focus({ preventScroll: true })
  }

  function startOrPause() {
    if (phase === 'running') {
      setPhase('paused')
      return
    }
    if (phase === 'paused') setPhase('running')
    else beginFlight()
    screenRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="dino-workspace flight-workspace">
      <section className="arcade-game" aria-labelledby="night-flight-title">
        <div className="arcade-game-header">
          <h2 id="night-flight-title">Night Flight</h2>
          <div className="arcade-header-controls">
            <div className="dino-mode" role="group" aria-label="Who controls the bird">
              <button type="button" aria-pressed={mode === 'human'} onClick={() => selectMode('human')}>
                <span className="dino-mode-star" aria-hidden="true">★</span>Human
              </button>
              <button type="button" aria-pressed={mode === 'ai'} onClick={() => selectMode('ai')}>
                <span className="dino-mode-star" aria-hidden="true">★</span>AI
              </button>
            </div>
            <div className="arcade-controls">
              <button type="button" className="arcade-primary" onClick={startOrPause}>{playLabel[phase]}</button>
              <button type="button" onClick={() => {
                resetFlight()
                setPhase('ready')
                screenRef.current?.focus({ preventScroll: true })
              }} disabled={phase === 'ready'}>Reset</button>
              <button type="button" onClick={() => {
                flapAsHuman()
                screenRef.current?.focus({ preventScroll: true })
              }} disabled={phase !== 'running' || mode !== 'human'}>Flap</button>
            </div>
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
          {mode === 'human'
            ? 'Press Space or ↑, or tap the screen to flap through the pipes. Press Esc to pause.'
            : 'The AI flies automatically. Switch to Human to take over, or press Esc to pause.'}
        </p>
        <span className="arcade-visually-hidden" role="status">{screenLabel[phase]}</span>
      </section>
      <FlightVision sample={sample} aiControls={mode === 'ai'} />
    </div>
  )
}
