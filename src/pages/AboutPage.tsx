import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import { createAboutVisit } from '../lib/aboutContent'
import type { AboutItem } from '../lib/about'
import PageBackground from '../components/PageBackground'
import '../styles/AboutPage.css'

type AboutPageProps = {
  sections: AboutItem[]
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
  navigationDisabled: boolean
}

function imageUrl(folder: 'menu' | 'character', filename: string) {
  return `${import.meta.env.BASE_URL}image/${folder}/${encodeURIComponent(filename)}`
}

export default function AboutPage({ sections: items, backgroundVideo, headingRef, onBack, navigationDisabled }: AboutPageProps) {
  // This initializer runs on each page entry, not on section switches/renders.
  const [sections] = useState(() => createAboutVisit(items))
  const [activeId, setActiveId] = useState(sections[0].id)
  const [revealed, setRevealed] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const activeIndex = Math.max(0, sections.findIndex(section => section.id === activeId))
  const active = sections[activeIndex]

  function closeDetail() {
    setRevealed(false)
    menuRef.current?.querySelectorAll<HTMLButtonElement>('.about-menu-item')[activeIndex]?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (revealed && !navigationDisabled) detailHeadingRef.current?.focus({ preventScroll: !window.matchMedia('(max-width: 1000px)').matches })
  }, [revealed, activeId, navigationDisabled])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setRevealed(false)
      menuRef.current?.querySelectorAll<HTMLButtonElement>('.about-menu-item')[activeIndex]?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [revealed, activeIndex, navigationDisabled])

  function handleMenuKeys(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.about-menu-item') ?? [])
    let next = Math.max(0, buttons.indexOf(event.target as HTMLButtonElement))
    if (event.key === 'ArrowDown') next = (next + 1) % sections.length
    if (event.key === 'ArrowUp') next = (next - 1 + sections.length) % sections.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = sections.length - 1
    menuRef.current?.querySelectorAll<HTMLButtonElement>('.about-menu-item')[next]?.focus({ preventScroll: true })
  }

  function changeSection(offset: number) {
    setActiveId(sections[(activeIndex + offset + sections.length) % sections.length].id)
  }

  return (
    <main className="content-page about-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="about-header">
        <button className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <p className="about-eyebrow">THE PERSON BEHIND THE MASK</p>
        <h1 ref={headingRef} tabIndex={-1}>ABOUT <span>ME.</span></h1>
        <p className="about-header-note">{String(sections.length).padStart(2, '0')} FILES / SELECT TO REVEAL</p>
      </header>

      <div className="about-layout">
        <aside className="about-sidebar">
          <p className="about-section-label"><span aria-hidden="true">★</span> PERSONAL FILES</p>
          <nav ref={menuRef} className="about-menu" aria-label="About sections" onKeyDown={handleMenuKeys}>
            {sections.map((section, index) => (
              <button
                key={section.id}
                className={`about-menu-item${section.id === active.id ? ' is-active' : ''}`}
                aria-expanded={revealed && section.id === active.id}
                aria-controls="about-detail"
                onClick={() => { setActiveId(section.id); setRevealed(true) }}
              >
                <span className="about-menu-portrait" aria-hidden="true">
                  {section.menuImage ? <img src={imageUrl('menu', section.menuImage)} alt="" /> : <span>★</span>}
                </span>
                <span className="about-menu-copy">
                  <span className="about-menu-tag">{String(index + 1).padStart(2, '0')} / {section.menuLabel}</span>
                  <span className="about-menu-title">{section.menuSubtitle || section.menuLabel}</span>
                </span>
                <span className="about-menu-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <p className="about-keyboard-hint"><kbd>↑</kbd> <kbd>↓</kbd> SELECT <kbd>↵</kbd> REVEAL</p>
        </aside>

        <section id="about-detail" className="about-detail-slot" aria-label="Selected personal file">
          {revealed ? (
            <article key={active.id} className="about-detail" aria-labelledby="about-detail-title">
              <div className="about-detail-toolbar">
                <span>FILE {String(activeIndex + 1).padStart(2, '0')} / {active.menuLabel}</span>
                <button onClick={closeDetail} className="about-close" aria-label="Close details">CLOSE ×</button>
              </div>
              <div className={`about-detail-body${active.characterImage ? ' has-character' : ''}`}>
                <div className="about-detail-copy">
                  <p className="about-detail-subtitle">{active.menuSubtitle || active.menuLabel}</p>
                  <h2 id="about-detail-title" ref={detailHeadingRef} tabIndex={-1}>{active.detailTitle}</h2>
                  {active.detailDescription && <p className="about-description">{active.detailDescription}</p>}
                  {active.detailHighlight && <p className="about-highlight"><span aria-hidden="true">★</span>{active.detailHighlight}</p>}
                </div>
                {active.characterImage && (
                  <div className="about-character" aria-hidden="true">
                    <span className="about-character-star">★</span>
                    <img src={imageUrl('character', active.characterImage)} alt="" />
                  </div>
                )}
              </div>
              <footer className="about-detail-footer">
                <button className="utility-button" onClick={() => changeSection(-1)}>← PREVIOUS</button>
                <span>{String(activeIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span>
                <button className="utility-button" onClick={() => changeSection(1)}>NEXT →</button>
              </footer>
            </article>
          ) : (
            <div className="about-invitation">
              <span className="about-invitation-star" aria-hidden="true">★</span>
              <p>THERE’S MORE</p>
              <strong>TO THE STORY.</strong>
              <span>OPEN A PERSONAL FILE TO TAKE A LOOK.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
