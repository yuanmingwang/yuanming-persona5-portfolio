import { useEffect } from 'react'
import '../styles/PageTransition.css'

type PageTransitionProps = {
  phase: 'cover' | 'reveal'
  label: string
  returning: boolean
  onCovered: () => void
  onComplete: () => void
}

export default function PageTransition({ phase, label, returning, onCovered, onComplete }: PageTransitionProps) {
  // Animation events drive navigation. This backup also releases the overlay if
  // a browser skips an event (for example after suspending a background tab).
  useEffect(() => {
    const timeout = window.setTimeout(phase === 'cover' ? onCovered : onComplete, phase === 'cover' ? 700 : 1100)
    return () => window.clearTimeout(timeout)
  }, [phase, onCovered, onComplete])

  return (
    <div
      className={`page-transition page-transition--${phase}${returning ? ' page-transition--return' : ''}`}
      aria-hidden="true"
      onAnimationEnd={event => {
        if (event.target !== event.currentTarget) return
        if (event.animationName === 'p5-cover') onCovered()
        if (event.animationName === 'p5-reveal') onComplete()
      }}
    >
      <div className="transition-speed-lines" />
      <div className="transition-slash transition-slash--top" />
      <div className="transition-slash transition-slash--bottom" />
      <div className="transition-burst" />
      <div className="transition-card">
        <span className="transition-eyebrow">{returning ? 'BACK TO THE HIDEOUT' : 'TAKE YOUR TIME'}</span>
        <strong className="transition-label">{label}</strong>
        <span className="transition-signature"><span>★</span> YUANMING’S PERSONA</span>
      </div>
    </div>
  )
}
