import { useMenuKeyboard } from '../hooks/useMenuKeyboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import PageBackground from '../components/PageBackground'
import { filterJourney, journeyTypeLabels } from '../lib/journey'
import type { JourneyChapter, JourneyFilter } from '../lib/journey'
import '../styles/JourneyPage.css'

type JourneyPageProps = {
  chapters: JourneyChapter[]
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
  navigationDisabled: boolean
}

function iconUrl(filename: string) {
  return `${import.meta.env.BASE_URL}image/icon/${encodeURIComponent(filename)}`
}

export default function JourneyPage({ chapters, backgroundVideo, headingRef, onBack, navigationDisabled }: JourneyPageProps) {
  const [filter, setFilter] = useState<JourneyFilter>('all')
  const [selectedId, setSelectedId] = useState(chapters[0].id)
  const [revealed, setRevealed] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const visible = filterJourney(chapters, filter)
  const selectedIndex = Math.max(0, visible.findIndex(chapter => chapter.id === selectedId))
  const selected = visible[selectedIndex]
  const chapterNumber = chapters.findIndex(chapter => chapter.id === selected?.id) + 1
  const countries = [...new Set(chapters.map(chapter => chapter.country))]
  const current = chapters.filter(chapter => chapter.type === 'location').at(-1)
  const filters: { id: JourneyFilter; label: string }[] = [
    { id: 'all', label: 'ALL CHAPTERS' },
    ...chapters.some(chapter => chapter.type === 'education') ? [{ id: 'education' as const, label: 'LEARNING' }] : [],
    ...chapters.some(chapter => chapter.type === 'experience') ? [{ id: 'experience' as const, label: 'BUILDING' }] : [],
  ]

  const closeDetail = useCallback(() => {
    setRevealed(false)
    menuRef.current?.querySelectorAll<HTMLButtonElement>('.journey-step')[selectedIndex]?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 950px)').matches) menuRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [selectedIndex])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    detailRef.current?.querySelector<HTMLHeadingElement>('h2')?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 950px)').matches) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [revealed, selectedId, navigationDisabled])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeDetail()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [revealed, navigationDisabled, closeDetail])

  function selectFilter(next: JourneyFilter) {
    setFilter(next)
    setSelectedId(filterJourney(chapters, next)[0].id)
    setRevealed(false)
  }

  useMenuKeyboard({
    menuRef: menuRef,
    selector: '.journey-step',
    activeIndex: selectedIndex,
    onMove: index => setSelectedId(visible[index].id),
    disabled: navigationDisabled,
  })

  function openChapter(id: string) { setSelectedId(id); setRevealed(true) }
  function nextChapter(offset: number) { openChapter(visible[(selectedIndex + offset + visible.length) % visible.length].id) }

  return (
    <main className="content-page journey-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="journey-header">
        <button className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <p className="journey-eyebrow">PLACES. PEOPLE. PROGRESS.</p>
        <h1 ref={headingRef} tabIndex={-1}>THE ROAD <span>SO FAR.</span></h1>
        <div className="journey-header-bottom">
          <div><p>From engineering foundations to games, graphics, and data.</p><div className="journey-countries">{countries.map(country => <span key={country}>{country}</span>)}</div></div>
          <p className="journey-range"><strong>{chapters[0].year} — {current ? 'NOW' : chapters.at(-1)!.year}</strong><span>{String(chapters.length).padStart(2, '0')} CHAPTERS TO EXPLORE</span></p>
        </div>
      </header>

      <div className="journey-layout">
        <aside className="journey-sidebar">
          <div className="journey-index-heading"><span>★ THE CHAPTER INDEX</span><span>{String(visible.length).padStart(2, '0')} FILES</span></div>
          <nav className="journey-filters" aria-label="Journey filters">{filters.map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => selectFilter(item.id)}>{item.label}</button>)}</nav>
          <nav ref={menuRef} className="journey-list" aria-label="Journey chapters">
            {visible.map(chapter => (
              <button key={chapter.id} className={`journey-step${selected?.id === chapter.id ? ' is-active' : ''}`} aria-expanded={revealed && selected?.id === chapter.id} aria-controls="journey-story" onClick={() => openChapter(chapter.id)}>
                <img src={iconUrl(chapter.icon)} alt="" />
                <span className="journey-step-copy"><span className="journey-step-meta"><strong>{chapter.year}</strong><span>{journeyTypeLabels[chapter.type]}</span></span><strong className="journey-step-title">{chapter.title}</strong><span className="journey-step-place">{chapter.organization} · {chapter.city}</span></span>
                <span className="journey-step-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <p className="journey-key-hint"><kbd>↑</kbd> <kbd>↓</kbd> BROWSE <kbd>↵</kbd> REVEAL</p>
          <p className="journey-date-note">Study and work chapters can overlap.</p>
        </aside>

        <section id="journey-story" ref={detailRef} className="journey-story-slot" aria-label="Journey chapter details">
          {revealed && selected ? (
            <article key={selected.id} className="journey-story" aria-labelledby="journey-story-title">
              <div className="journey-story-strip"><span>CHAPTER {String(chapterNumber).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}</span><span>{journeyTypeLabels[selected.type]}</span><button onClick={closeDetail} aria-label="Close chapter">CLOSE ×</button></div>
              <div className="journey-story-content">
                <div className="journey-story-heading"><div><p className="journey-story-year">{selected.year}</p><h2 id="journey-story-title" tabIndex={-1}>{selected.title}</h2></div><img src={iconUrl(selected.landmarkImage)} alt="" /></div>
                <p className="journey-organization">{selected.organization}</p>
                <div className="journey-facts"><span>{selected.period}</span><span>{selected.city}, {selected.country}</span></div>
                <p className="journey-description">{selected.description}</p>
                {!!selected.highlights.length && <ul className="journey-highlights">{selected.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul>}
                {!!selected.topics.length && <div className="journey-topics">{selected.topics.map((topic, index) => <span key={index}>{topic}</span>)}</div>}
              </div>
              <footer className="journey-story-footer"><button className="utility-button" onClick={() => nextChapter(-1)}>← PREVIOUS</button><span>{String(selectedIndex + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')}</span><button className="utility-button" onClick={() => nextChapter(1)}>NEXT →</button></footer>
            </article>
          ) : (
            <div className="journey-invitation">
              <div className="journey-postmarks" aria-hidden="true">{['p5_east_college.webp', 'p5_columbia_low_library.webp', 'p5_victoria_bc_parliament.webp'].map(filename => <img key={filename} src={iconUrl(filename)} alt="" />)}</div>
              <p>EVERY CHAPTER</p><strong>LEADS SOMEWHERE.</strong><span>OPEN A CHAPTER. FOLLOW THE JOURNEY.</span>
              {current && <div className="journey-current"><span>NOW / CURRENT LOCATION</span><p>{current.city}, {current.country}</p></div>}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
