import { useCallback, useEffect, useRef, useState } from 'react'
import { getStingerCue } from '../lib/navigation'
import '../styles/PageTransition.css'

type PageTransitionProps = {
  phase: 'cover' | 'reveal'
  label: string
  returning: boolean
  onCovered: () => void
  onComplete: () => void
}

type PlaybackMode = 'checking' | 'video' | 'fallback'

export default function PageTransition({ phase, label, returning, onCovered, onComplete }: PageTransitionProps) {
  const [mode, setMode] = useState<PlaybackMode>('checking')
  const videoRef = useRef<HTMLVideoElement>(null)
  const coveredRef = useRef(false)
  const callbacks = useRef({ onCovered, onComplete })

  // Keep the current callbacks without restarting the video when the page swaps.
  useEffect(() => {
    callbacks.current = { onCovered, onComplete }
  }, [onCovered, onComplete])

  const markCovered = useCallback(() => {
    if (coveredRef.current) return
    coveredRef.current = true
    callbacks.current.onCovered()
  }, [])

  const checkMediaTime = useCallback((time: number) => {
    if (coveredRef.current) return
    const cue = getStingerCue(time)
    if (cue === 'covered') markCovered()
    if (cue === 'fallback') setMode('fallback')
  }, [markCovered])

  function finishVideo() {
    // If no covered frame was delivered, let the CSS wipe hide the page swap.
    if (!coveredRef.current) setMode('fallback')
    else callbacks.current.onComplete()
  }

  async function startVideo() {
    const video = videoRef.current
    if (!video) return
    try {
      // The source's first frame is transparent. Some browsers decode VP9 video
      // but discard its alpha channel; test that before displaying the element.
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 9
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Cannot check video transparency')
      context.drawImage(video, 0, 0, 16, 9)
      const pixels = context.getImageData(0, 0, 16, 9).data
      // pixel contains four numbers: R, G, B, A. The alpha values are at indices 3, 7, 11, etc.
      // index % 4 === 3 selects only those alpha values.
      const hasTransparency = pixels.some((value, index) => index % 4 === 3 && value < 16)
      if (!hasTransparency) throw new Error('Video alpha is unsupported')
      setMode('video')
      await video.play()
    } catch {
      setMode('fallback')
    }
  }

  useEffect(() => {
    if (mode !== 'video') return
    const video = videoRef.current
    if (!video) return
    let frame = 0
    let stopped = false

    // Use media time, not a wall-clock timeout: buffering must not swap the
    // page while the animation is still transparent over the old page.
    function checkFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
      if (stopped || !video) return
      checkMediaTime(metadata.mediaTime)
      frame = video.requestVideoFrameCallback(checkFrame)
    }
    if ('requestVideoFrameCallback' in video) frame = video.requestVideoFrameCallback(checkFrame)
    const watchdog = window.setTimeout(() => setMode('fallback'), 10000)
    return () => {
      stopped = true
      if (frame) video.cancelVideoFrameCallback(frame)
      window.clearTimeout(watchdog)
    }
  }, [mode, checkMediaTime])

  useEffect(() => {
    if (mode === 'video') return
    const complete = phase === 'cover' ? onCovered : onComplete
    const delay = mode === 'checking' ? 3000 : phase === 'cover' ? 700 : 1100
    const timeout = window.setTimeout(mode === 'checking' ? () => setMode('fallback') : complete, delay)
    return () => window.clearTimeout(timeout)
  }, [mode, phase, onCovered, onComplete])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const skip = () => {
      if (!preference.matches) return
      markCovered()
      callbacks.current.onComplete()
    }
    preference.addEventListener('change', skip)
    return () => preference.removeEventListener('change', skip)
  }, [markCovered])

  return (
    <div
      className={`page-transition ${mode === 'fallback' ? `page-transition--${phase}${returning ? ' page-transition--return' : ''}` : `page-transition--${mode}`}`}
      data-phase={phase}
      aria-hidden="true"
      onAnimationEnd={event => {
        if (mode !== 'fallback' || event.target !== event.currentTarget) return
        if (event.animationName === 'p5-cover') markCovered()
        if (event.animationName === 'p5-reveal') callbacks.current.onComplete()
      }}
    >
      {mode !== 'fallback' ? (
        <video
          ref={videoRef}
          className="transition-video"
          src={`${import.meta.env.BASE_URL}video/Persona_5_Stinger_Transition.webm`}
          muted
          playsInline
          preload="auto"
          onLoadedData={startVideo}
          onTimeUpdate={event => {
            if (mode === 'video') checkMediaTime(event.currentTarget.currentTime)
          }}
          onEnded={finishVideo}
          onError={() => setMode('fallback')}
        />
      ) : (
        <>
          <div className="transition-speed-lines" />
          <div className="transition-slash transition-slash--top" />
          <div className="transition-slash transition-slash--bottom" />
          <div className="transition-burst" />
          <div className="transition-card">
            <span className="transition-eyebrow">{returning ? 'BACK TO THE HIDEOUT' : 'TAKE YOUR TIME'}</span>
            <strong className="transition-label">{label}</strong>
            <span className="transition-signature"><span>★</span> YUANMING’S PERSONA</span>
          </div>
        </>
      )}
    </div>
  )
}
