import { useEffect, useReducer, useRef, useState } from 'react'
import { loadMenu, localMenu } from './lib/content'
import HomePage from './pages/HomePage'
import SoundToggle from './components/SoundToggle'
import PageTransition from './components/PageTransition'
import PageBackground from './components/PageBackground'
import AboutPage from './pages/AboutPage'
import { loadAbout, localAbout } from './lib/aboutContent'
import { initialNavigation, navigationReducer } from './lib/navigation'
import './styles/App.css'

function App() {
  const [menu, setMenu] = useState(localMenu)
  const [aboutSections, setAboutSections] = useState(localAbout)
  const [navigation, dispatch] = useReducer(navigationReducer, initialNavigation)
  const { page: currentPage, transition } = navigation
  const pageRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadMenu(controller.signal).then(setMenu).catch(error => {
      if (!controller.signal.aborted) {
        console.warn('Using local menu CSV because the remote menu could not load.', error)
      }
    })
    loadAbout(controller.signal).then(setAboutSections).catch(error => {
      if (!controller.signal.aborted) console.warn('Using local About CSV because remote content could not load.', error)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (transition?.phase === 'cover') return
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (transition) return // Focus the destination only after the overlay clears.
    if (currentPage !== null) headingRef.current?.focus({ preventScroll: true })
    else pageRef.current?.querySelector<HTMLButtonElement>('.menu-item')?.focus({ preventScroll: true })
  }, [currentPage, transition])

  function navigate(target: string | null) {
    dispatch({
      type: 'navigate',
      target,
      label: target === null ? 'MAIN MENU' : menu.find(item => item.id === target)?.label ?? 'NEXT CHAPTER',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    })
  }

  const page = menu.find(item => item.id === currentPage)

  return (
    <>
      <div ref={pageRef} inert={transition !== null} aria-busy={transition !== null}>
        {currentPage === null ? (
          <HomePage items={menu} onSelect={navigate} navigationDisabled={transition !== null} />
        ) : currentPage === 'about' ? (
          <AboutPage
            key={JSON.stringify(aboutSections)}
            sections={aboutSections}
            backgroundVideo={page?.pageBackgroundVideo}
            headingRef={headingRef}
            onBack={() => navigate(null)}
            navigationDisabled={transition !== null}
          />
        ) : (
          <main className="content-page">
            <PageBackground key={`${page?.id}:${page?.pageBackgroundVideo}`} filename={page?.pageBackgroundVideo} />
            <button className="utility-button" onClick={() => navigate(null)}>← BACK TO MENU</button>
            <p className="eyebrow">THE NEXT CHAPTER</p>
            <h1 ref={headingRef} tabIndex={-1}>{page?.label}</h1>
            <p>tododo</p>
          </main>
        )}
        <SoundToggle />
      </div>
      {transition && (
        <PageTransition
          phase={transition.phase}
          label={transition.label}
          returning={transition.target === null}
          onCovered={() => dispatch({ type: 'covered' })}
          onComplete={() => dispatch({ type: 'finished' })}
        />
      )}
    </>
  )
}

export default App
