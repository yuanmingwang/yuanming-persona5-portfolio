import { useEffect, useRef, useState } from 'react'
import { createGameAudio } from '../audio'
import { coinsCollected, createRun, stepRun, TICKS_PER_SECOND } from './engine'
import type { Movement, PhantomRun, Sound } from './engine'
import { HEIGHT, MAP_LABELS, WIDTH } from './map'
import { createMazePainter } from './render'
import { createTacticalPlayer } from './tactics'
import type { TacticalPlan } from './tactics'
import { createLearnedController, readLearnedActor } from './learned'
import type { LearnedDecision, LearnedMode } from './learned'
import PhantomVision from './PhantomVision'
import type { VisionFrames } from './PhantomVision'
import { createVisionPainter } from './vision'
import PhantomGuide from './PhantomGuide'

const STEP_MS = 1000 / TICKS_PER_SECOND
const MAX_SEED = 0xffff_ffff
const SOUND_NAMES = [
  'select', 'coin', 'unlock_exit', 'alert_enemy_detect_player', 'death',
  'level_clear', 'level_clear_perfect', 'warning_countdown_begin', 'warning_countdown',
] as const satisfies readonly (Sound | 'select')[]

const PAD = [
  ['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→'],
] as const

type Direction = typeof PAD[number][0]
const KEYS = new Map<string, Direction>([
  ['arrowup', 'up'], ['w', 'up'],
  ['arrowleft', 'left'], ['a', 'left'],
  ['arrowdown', 'down'], ['s', 'down'],
  ['arrowright', 'right'], ['d', 'right'],
])
type Phase = 'ready' | 'playing' | 'paused' | 'ended'
type Mode = 'human' | 'ai' | LearnedMode
const modes: [Mode, string][] = [['human', 'Human'], ['ai', 'Tactical A*'], ['state', 'State PPO'], ['vision', 'Spatial Vision']]
const buttonLabel = { ready: 'Start run', playing: 'Pause', paused: 'Resume', ended: 'Retry maze' }

function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

function readMovement(inputs: ReadonlyMap<string | number, Direction>): Movement {
  const directions = new Set(inputs.values())
  return {
    x: Math.sign(Number(directions.has('right')) - Number(directions.has('left'))) as Movement['x'],
    y: Math.sign(Number(directions.has('down')) - Number(directions.has('up'))) as Movement['y'],
  }
}

function readHud(run: PhantomRun) {
  return {
    seed: run.seed,
    level: run.level,
    family: run.board.maze.family,
    collected: coinsCollected(run.board),
    quota: run.board.quota,
    total: run.board.maze.coins.length,
    seconds: Math.ceil(run.board.ticksLeft / TICKS_PER_SECOND),
    score: run.score,
  }
}

export default function PhantomEscape() {
  const screenRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<PhantomRun | null>(null)
  const paintRef = useRef<ReturnType<typeof createMazePainter> | null>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio<(typeof SOUND_NAMES)[number]>> | null>(null)
  const inputs = useRef(new Map<string | number, Direction>())
  const [initialSeed] = useState(newSeed)
  const [seedInput, setSeedInput] = useState(() => String(initialSeed))
  const [seedError, setSeedError] = useState(false)
  const [mode, setMode] = useState<Mode>('ai')
  const [showPlan, setShowPlan] = useState(true)
  const [intent, setIntent] = useState('')
  const [planStats, setPlanStats] = useState<{ routeSteps: number; explored: number } | null>(null)
  const [learnedDecision, setLearnedDecision] = useState<LearnedDecision>()
  const controllerRef = useRef<ReturnType<typeof createTacticalPlayer> | null>(null)
  const learnedRef = useRef<ReturnType<typeof createLearnedController> | null>(null)
  const [visionFrames, setVisionFrames] = useState<VisionFrames | null>(null)
  const [actor, setActor] = useState<ReturnType<typeof readLearnedActor> | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [failure, setFailure] = useState<PhantomRun['ended']>(null)
  const [hud, setHud] = useState(() => readHud(createRun(initialSeed)))
  const [effects, setEffects] = useState(true)
  const isLearnedMode = mode === 'state' || mode === 'vision'

  useEffect(() => {
    const context = screenRef.current?.getContext('2d')
    const run = createRun(initialSeed)
    runRef.current = run
    if (context) {
      paintRef.current = createMazePainter(context)
      paintRef.current(run)
    }
  }, [initialSeed])

  useEffect(() => () => {
    audioRef.current?.close()
    audioRef.current = null
  }, [])

  useEffect(() => {
    const run = runRef.current
    if (run) paintRef.current?.(run, mode === 'ai' && showPlan ? controllerRef.current?.plan : undefined)
  }, [mode, showPlan])

  useEffect(() => {
    if ((mode !== 'state' && mode !== 'vision') || actor) return
    let active = true
    import('./learned-weights.json').then(({ default: weights }) => {
      if (!active) return
      const loaded = readLearnedActor(weights)
      setActor(() => loaded)
      setLoadFailed(false)
    }).catch(() => {
      if (active) setLoadFailed(true)
    })
    return () => { active = false }
  }, [mode, actor])

  useEffect(() => {
    if (phase !== 'playing') return
    const run = runRef.current
    const paint = paintRef.current
    if (!run || !paint || (isLearnedMode && !actor)) return
    const activeInputs = inputs.current
    const controller = mode === 'ai' ? (controllerRef.current ??= createTacticalPlayer()) : undefined
    const learned = isLearnedMode && actor ? (learnedRef.current ??= createLearnedController(mode, actor)) : undefined
    let previousVision: Uint8Array | undefined
    let previousDecision: LearnedDecision | undefined
    let previousPlan: TacticalPlan | undefined
    let frame: number
    let previous: number | undefined
    let elapsed = 0
    let previousHud = readHud(run)
    let previousIntent = ''

    function animate(now: number) {
      if (!run || !paint || run !== runRef.current) return
      elapsed += Math.min(now - (previous ?? now), 80)
      previous = now
      const movement = readMovement(activeInputs)
      while (elapsed >= STEP_MS && !run.ended) {
        elapsed -= STEP_MS
        const input = learned?.movement(run) ?? controller?.movement(run) ?? movement
        for (const sound of stepRun(run, input)) audioRef.current?.play(sound)
      }
      const nextHud = readHud(run)
      if (nextHud.seconds !== previousHud.seconds || nextHud.score !== previousHud.score) {
        previousHud = nextHud
        setHud(nextHud)
      }
      const sampledPlan = controller?.plan
      const plan = sampledPlan?.floor === run.board.maze.floor ? sampledPlan : undefined
      const nextIntent = plan?.evading ? 'Evade' : (plan?.intent ?? '')
      if (nextIntent !== previousIntent) {
        previousIntent = nextIntent
        setIntent(nextIntent)
      }
      if (plan !== previousPlan) {
        previousPlan = plan
        setPlanStats(plan ? { routeSteps: Math.max(0, plan.route.length - 1), explored: plan.explored.size } : null)
      }
      if (learned?.decision !== previousDecision) {
        previousDecision = learned?.decision
        setLearnedDecision(previousDecision)
      }
      paint(run, showPlan ? plan : undefined)
      const observation = learned?.frame
      if (observation && observation !== previousVision) {
        previousVision = observation
        setVisionFrames(frames => frames?.current === observation
          ? frames : { current: observation, previous: frames?.current })
      }
      if (run.ended) {
        setFailure(run.ended)
        setPhase('ended')
      } else {
        frame = requestAnimationFrame(animate)
      }
    }

    function pauseWhenHidden() {
      if (document.hidden) setPhase('paused')
    }

    frame = requestAnimationFrame(animate)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      activeInputs.clear()
    }
  }, [mode, phase, showPlan, isLearnedMode, actor])

  function configureAudio(enabled: boolean) {
    if (enabled && !audioRef.current && typeof AudioContext !== 'undefined') {
      audioRef.current = createGameAudio('phantom-escape', SOUND_NAMES, 'mp3')
    }
    audioRef.current?.enable(enabled)
  }

  function resetRun(nextSeed: number) {
    const run = createRun(nextSeed)
    setSeedInput(String(run.seed))
    setSeedError(false)
    inputs.current.clear()
    runRef.current = run
    controllerRef.current = null
    learnedRef.current = null
    setVisionFrames(mode === 'vision' ? { current: createVisionPainter()(run.board) } : null)
    paintRef.current?.(run)
    setHud(readHud(run))
    setFailure(null)
    setIntent('')
    setPlanStats(null)
    setLearnedDecision(undefined)
  }

  function selectMode(nextMode: Mode) {
    if (nextMode === mode) return
    inputs.current.clear()
    controllerRef.current = null
    learnedRef.current = null
    const board = runRef.current?.board
    setVisionFrames(nextMode === 'vision' && board ? { current: createVisionPainter()(board) } : null)
    setLoadFailed(false)
    setIntent('')
    setPlanStats(null)
    setLearnedDecision(undefined)
    setMode(nextMode)
    screenRef.current?.focus({ preventScroll: true })
  }

  function togglePlay() {
    if (phase === 'playing') {
      setPhase('paused')
    } else {
      if (isLearnedMode && !actor) return
      if (phase === 'ended' && runRef.current) resetRun(runRef.current.seed)
      configureAudio(effects)
      audioRef.current?.play('select')
      screenRef.current?.scrollIntoView({ block: 'nearest' })
      setPhase('playing')
    }
    screenRef.current?.focus({ preventScroll: true })
  }

  const announcement = phase === 'ended' ? (failure === 'timeout' ? 'Time ran out' : 'Caught by a phantom')
    : phase === 'paused' ? 'Paused'
    : phase === 'ready' ? 'Ready to escape'
    : hud.collected >= hud.quota ? 'Exit unlocked' : ''

  const game = (
    <section className="arcade-game phantom-game" aria-labelledby="phantom-escape-title">
      <div className="arcade-game-header">
        <h2 id="phantom-escape-title">Phantom Escape</h2>
        <div className="arcade-header-controls">
          <div className="dino-mode" role="group" aria-label="Who controls the player">
            {modes.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => selectMode(id)}>
                <span className="dino-mode-star" aria-hidden="true">★</span>{label}
              </button>
            ))}
          </div>
          <div className="arcade-controls">
            <button type="button" className="arcade-primary" disabled={isLearnedMode && !actor}
              onClick={togglePlay}>{buttonLabel[phase]}</button>
            <button type="button" onClick={() => {
              resetRun(newSeed())
              setPhase('ready')
            }}>New maze</button>
          </div>
        </div>
      </div>

      <div className="arcade-screen">
        <canvas ref={screenRef} width={WIDTH} height={HEIGHT} tabIndex={0}
          aria-label="Phantom Escape maze" aria-describedby="phantom-help"
          onBlur={() => inputs.current.clear()}
          onKeyDown={event => {
            const key = event.key.toLowerCase()
            const direction = KEYS.get(key)
            if (direction && !event.altKey && !event.ctrlKey && !event.metaKey) {
              event.preventDefault()
              if (mode === 'human' && phase === 'playing') inputs.current.set(key, direction)
            } else if (event.key === ' ' || (event.key === 'Escape' && phase === 'playing')) {
              event.preventDefault()
              if (!event.repeat) togglePlay()
            }
          }}
          onKeyUp={event => inputs.current.delete(event.key.toLowerCase())}
        />
        {phase !== 'playing' && <div className="arcade-screen-status" aria-hidden="true">{announcement}</div>}
      </div>

      <div className="arcade-game-footer">
        <dl className="arcade-score phantom-score">
          <div><dt>Level</dt><dd>{hud.level}</dd></div>
          <div><dt>Map</dt><dd>{MAP_LABELS[hud.family]}</dd></div>
          <div><dt>Coins</dt><dd>{hud.collected}/{hud.total}</dd></div>
          <div><dt>Exit</dt><dd>{hud.collected >= hud.quota ? 'Open' : `${hud.quota - hud.collected} to go`}</dd></div>
          <div><dt>Time</dt><dd className={hud.seconds <= 10 ? 'phantom-urgent' : undefined}>{hud.seconds}s</dd></div>
          <div><dt>Score</dt><dd>{hud.score}</dd></div>
          <div><dt>Run seed</dt><dd>{hud.seed}</dd></div>
        </dl>
        <button type="button" className="utility-button arcade-sfx" aria-label="Game sound effects"
          aria-pressed={effects} onClick={() => {
            configureAudio(!effects)
            setEffects(!effects)
          }}>SFX {effects ? 'ON' : 'OFF'}</button>
      </div>

      <form className="phantom-seed" onSubmit={event => {
        event.preventDefault()
        const digits = seedInput.trim()
        const seed = Number(digits)
        if (!/^\d+$/.test(digits) || seed > MAX_SEED) {
          setSeedError(true)
          return
        }
        resetRun(seed)
        setPhase('ready')
        screenRef.current?.focus({ preventScroll: true })
      }}>
        <label htmlFor="phantom-seed">Maze seed</label>
        <input id="phantom-seed" type="text" inputMode="numeric" autoComplete="off" value={seedInput}
          aria-invalid={seedError || undefined} aria-describedby={seedError ? 'phantom-seed-error' : undefined}
          onChange={event => {
            setSeedInput(event.target.value)
            setSeedError(false)
          }} />
        <button type="submit" className="utility-button">Load seed</button>
        {seedError && <span id="phantom-seed-error" role="alert">Enter a whole number from 0 to 4,294,967,295.</span>}
      </form>

      {mode === 'human' && <div className="phantom-pad" role="group" aria-label="Touch movement">
        {PAD.map(([direction, label]) => (
          <button type="button" key={direction} className="utility-button" aria-label={direction}
            disabled={phase !== 'playing'} tabIndex={-1}
            onPointerDown={event => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              inputs.current.set(event.pointerId, direction)
            }}
            onLostPointerCapture={event => inputs.current.delete(event.pointerId)}
          >{label}</button>
        ))}
      </div>}
      <p id="phantom-help" className="arcade-help">
        In Human mode, move with WASD, arrow keys, or touch controls. Press Esc to pause.
      </p>
      <PhantomGuide />
      <span className="arcade-visually-hidden" role="status">{announcement}</span>
    </section>
  )

  return (
    <div className="dino-workspace phantom-workspace">
      {game}
      <PhantomVision mode={mode} intent={intent} learnedDecision={learnedDecision} planStats={planStats}
        frames={visionFrames} showPlan={showPlan} onShowPlan={setShowPlan}
        modelStatus={isLearnedMode && !actor ? (loadFailed ? 'Could not load the learned policy.' : 'Loading the learned policy…') : undefined} />
    </div>
  )
}
