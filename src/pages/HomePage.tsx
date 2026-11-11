import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MenuItem } from '../lib/content'

type HomePageProps = {
  items: MenuItem[]
  onSelect: (id: string) => void
}

function HomePage({ items, onSelect }: HomePageProps) {
  const [activeId, setActiveId] = useState(items[0].id)
  const [motionPaused, setMotionPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const menuRef = useRef<HTMLElement>(null)
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId))

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const current = items.findIndex(item => item.id === activeId)
    let next = Math.max(0, current)
    if (event.key === 'ArrowDown') next = (next + 1) % items.length
    if (event.key === 'ArrowUp') next = (next - 1 + items.length) % items.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    menuRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item')[next]?.focus()
  }

  async function toggleMotion() {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      setMotionPaused(true)
    } else {
      try {
        await video.play()
        setMotionPaused(false)
      } catch {
        setMotionPaused(true)
      }
    }
  }

  return (
    <main className="home-page">
      <video
        ref={videoRef}
        className="menu-video"
        src={`${import.meta.env.BASE_URL}video/Joker animated wallpaper.mp4`}
        autoPlay={!motionPaused}
        loop
        muted
        playsInline
        aria-hidden="true"
        onError={() => setMotionPaused(true)}
      />
      <div className="menu-shade" aria-hidden="true" />
      <div className="menu-paper" aria-hidden="true" />

      <header className="menu-header">
        {/* <p className="eyebrow"><span aria-hidden="true">★</span> TAKE YOUR TIME</p> */}
        <h1><span>YUANMING’S</span><span>PERSONA<span className="title-star" aria-hidden="true">★</span></span></h1>
        {/* <p className="portfolio-tag">THE PORTFOLIO / VOL. 01</p> */}
      </header>

      <section className="menu-panel" aria-label="Portfolio menu">
        <p className="menu-kicker">CHOOSE YOUR NEXT MOVE</p>
        <nav ref={menuRef} className="home-menu" aria-label="Main navigation" onKeyDown={handleKeys}>
          {items.map((item, index) => (
            <button
              key={item.id}
              autoFocus={index === 0}
              className={`menu-item ${index === activeIndex ? 'is-active' : ''}`}
              onFocus={() => setActiveId(item.id)}
              onPointerEnter={() => setActiveId(item.id)}
              onClick={() => onSelect(item.id)}
            >
              <span className="menu-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="menu-label">{item.label}</span>
              <span className="menu-arrow" aria-hidden="true">➜</span>
            </button>
          ))}
        </nav>
        <p className="menu-counter">{String(activeIndex + 1).padStart(2, '0')} <span>/ {String(items.length).padStart(2, '0')} — MAKE YOUR CHOICE</span></p>
      </section>

      <div className="calling-card" aria-hidden="true"><span>THIS IS</span><strong>MY STORY.</strong><span>LET’S MAKE IT COUNT.</span></div>

      <footer className="menu-footer">
        <button className="utility-button motion-button" onClick={toggleMotion} aria-pressed={motionPaused}>
          {motionPaused ? 'PLAY BACKGROUND' : 'PAUSE BACKGROUND'}
        </button>
        <p className="keyboard-hint"><kbd>↑</kbd><kbd>↓</kbd> NAVIGATE <span><kbd>↵</kbd> CONFIRM</span></p>
      </footer>
    </main>
  )
}

export default HomePage
