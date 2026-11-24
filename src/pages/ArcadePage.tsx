import { lazy, Suspense, useState } from 'react'
import type { Ref } from 'react'
import PageBackground from '../components/PageBackground'
import '../styles/ArcadePage.css'

const demos = [
  { id: 'dino', title: 'Dino Runner', description: 'Endless runner', Game: lazy(() => import('../demos/dino/DinoRunner')) },
  { id: 'night-flight', title: 'Night Flight', description: 'Flap through the pipes', Game: lazy(() => import('../demos/night-flight/NightFlight')) },
]

type ArcadePageProps = {
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
}

export default function ArcadePage({ backgroundVideo, headingRef, onBack }: ArcadePageProps) {
  const [selected, setSelected] = useState(demos[0])
  const { Game } = selected

  return (
    <main className="content-page arcade-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="arcade-header">
        <button type="button" className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <h1 ref={headingRef} tabIndex={-1}>ARCADE<span aria-hidden="true">★</span></h1>
        <p>Play the arcade games or watch the AI take the controls.</p>
      </header>
      <div className="arcade-layout">
        <nav className="arcade-catalog" aria-label="Demos">
          {demos.map(demo => (
            <button key={demo.id} type="button" aria-current={selected.id === demo.id ? 'true' : undefined}
              onClick={() => setSelected(demo)}>
              <strong>{demo.title}</strong>
              <span>{demo.description}</span>
            </button>
          ))}
        </nav>
        <Suspense fallback={<p role="status">Loading {selected.title}…</p>}>
          <Game key={selected.id} />
        </Suspense>
      </div>
    </main>
  )
}
