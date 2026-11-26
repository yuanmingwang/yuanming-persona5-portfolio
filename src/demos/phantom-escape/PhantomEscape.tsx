import { useEffect, useRef, useState } from 'react'
import { createGameAudio } from '../audio'
import { coinsCollected, createRun, stepRun, TICKS_PER_SECOND } from './engine'
import type { Movement, PhantomRun, Sound } from './engine'
import { HEIGHT, MAP_LABELS, WIDTH } from './map'
import { createMazePainter } from './render'
import { createTacticalPlayer } from './tactics'
import { ACTION_LABELS, createLearnedController, readLearnedActor } from './learned'
import type { LearnedMode } from './learned'
import { VISION_HEIGHT, VISION_WIDTH } from './vision'

const STEP_MS = 1000 / TICKS_PER_SECOND
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
    level: run.level,
    family: run.board.maze.family,
    collected: coinsCollected(run.board),
    quota: run.board.quota,
    total: run.board.maze.coins.length,
    seconds: Math.ceil(run.board.ticksLeft / TICKS_PER_SECOND),
    score: run.score,
  }
}

function drawVision(canvas: HTMLCanvasElement | null, pixels: Uint8Array) {
  const context = canvas?.getContext('2d')
  if (!context) return
  const image = context.createImageData(VISION_WIDTH, VISION_HEIGHT)
  for (let offset = 0, pixel = 0; offset < pixels.length; offset += 3, pixel += 4) {
    image.data[pixel] = pixels[offset]
    image.data[pixel + 1] = pixels[offset + 1]
    image.data[pixel + 2] = pixels[offset + 2]
    image.data[pixel + 3] = 255
  }
  context.putImageData(image, 0, 0)
}

export default function PhantomEscape() {
  const screenRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<PhantomRun | null>(null)
  const paintRef = useRef<ReturnType<typeof createMazePainter> | null>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio<(typeof SOUND_NAMES)[number]>> | null>(null)
  const inputs = useRef(new Map<string | number, Direction>())
  const [initialSeed] = useState(newSeed)
  const [mode, setMode] = useState<Mode>('ai')
  const [showPlan, setShowPlan] = useState(true)
  const [intent, setIntent] = useState('')
  const controllerRef = useRef<ReturnType<typeof createTacticalPlayer> | null>(null)
  const learnedRef = useRef<ReturnType<typeof createLearnedController> | null>(null)
  const visionRef = useRef<HTMLCanvasElement>(null)
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
    let frame: number
    let previous: number | undefined
    let elapsed = 0
    let previousHud = readHud(run)
    let previousIntent = ''

    function animate(now: number) {
      if (!run || !paint) return
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
      const plan = controller?.plan
      const nextIntent = learned ? ACTION_LABELS[learned.action] : plan?.evading ? 'Evade' : (plan?.intent ?? '')
      if (nextIntent !== previousIntent) {
        previousIntent = nextIntent
        setIntent(nextIntent)
      }
      paint(run, showPlan ? plan : undefined)
      if (learned?.frame && learned.frame !== previousVision) {
        previousVision = learned.frame
        drawVision(visionRef.current, previousVision)
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
    inputs.current.clear()
    runRef.current = run
    controllerRef.current = null
    learnedRef.current = null
    visionRef.current?.getContext('2d')?.clearRect(0, 0, VISION_WIDTH, VISION_HEIGHT)
    paintRef.current?.(run)
    setHud(readHud(run))
    setFailure(null)
    setIntent('')
  }

  function selectMode(nextMode: Mode) {
    if (nextMode === mode) return
    inputs.current.clear()
    controllerRef.current = null
    learnedRef.current = null
    setLoadFailed(false)
    setIntent('')
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

  return (
    <section className="arcade-game phantom-game" aria-labelledby="phantom-escape-title">
      <div className="arcade-game-header">
        <h2 id="phantom-escape-title">Phantom Escape</h2>
        <div className="arcade-header-controls">
          <div className="dino-mode" role="group" aria-label="Who controls the player">
            {modes.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => selectMode(id)}>{label}</button>
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
        </dl>
        <button type="button" className="utility-button arcade-sfx" aria-label="Game sound effects"
          aria-pressed={effects} onClick={() => {
            configureAudio(!effects)
            setEffects(!effects)
          }}>SFX {effects ? 'ON' : 'OFF'}</button>
      </div>

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
        {mode === 'human'
          ? 'Move with WASD, arrow keys or the touch arrows. Collect enough coins to unlock the door before time runs out.'
          : mode === 'ai' ? 'Tactical A* collects coins and routes around phantoms.'
            : mode === 'state' ? 'State PPO uses the simulator’s positions to score moves.'
              : 'Spatial Vision scores moves using the rendered pixels and HUD.'}
        {' Press Esc to pause.'}
      </p>
      {isLearnedMode && <div className="phantom-plan arcade-help">
        {!actor && <span role="status">{loadFailed ? 'Could not load the learned policy.' : 'Loading the learned policy…'}</span>}
        {mode === 'vision' && <figure className="phantom-vision">
          <canvas ref={visionRef} width={VISION_WIDTH} height={VISION_HEIGHT} aria-label="Pixels used by Spatial Vision" />
          <figcaption>Model input</figcaption>
        </figure>}
        {intent && <strong>Action {intent}</strong>}
      </div>}
      {mode === 'ai' && <div className="phantom-plan arcade-help">
        <label><input type="checkbox" checked={showPlan} onChange={event => setShowPlan(event.target.checked)} /> Show AI plan</label>
        {showPlan && <span>Teal path · blue explored tiles · red danger</span>}
        {intent && <strong>{intent}</strong>}
      </div>}
      <span className="arcade-visually-hidden" role="status">{announcement}</span>
    </section>
  )
}
