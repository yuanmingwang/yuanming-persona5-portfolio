import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import PageBackground from '../components/PageBackground'
import images from '../content/about-images.json'
import { pickImage } from '../lib/about'
import { assignResumeFooterImages, filterResume, resumeCategories } from '../lib/resume'
import type { ResumeCategory, ResumeEntry } from '../lib/resume'
import '../styles/ResumePage.css'

type ResumePageProps = {
  entries: ResumeEntry[]
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
}

export default function ResumePage({ entries, backgroundVideo, headingRef, onBack }: ResumePageProps) {
  const categories = resumeCategories.filter(category => entries.some(entry => entry.section === category.id))
  const [category, setCategory] = useState<ResumeCategory>(categories[0].id)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const detailRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const profile = entries.find(entry => entry.section === 'profile')!
  // A fresh draw on each page mount; category/search changes keep this portrait.
  const [characterImage] = useState(() => pickImage(images.character, profile.image))
  const [footerImages] = useState(() => assignResumeFooterImages(entries, images.confidant))
  const visible = useMemo(() => filterResume(entries, category, query), [entries, category, query])
  const selected = visible.find(entry => entry.id === selectedId) ?? visible[0]
  const categoryLabel = resumeCategories.find(item => item.id === category)!.label
  const count = (section: ResumeCategory) => entries.filter(entry => entry.section === section).length

  function chooseCategory(next: ResumeCategory) {
    setCategory(next)
    setQuery('')
    setSelectedId('')
  }

  function chooseEntry(entry: ResumeEntry) {
    setSelectedId(entry.id)
    // On stacked layouts, bring the selected record into view after React paints.
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => {
        detailRef.current?.focus({ preventScroll: true })
        detailRef.current?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    }
  }

  function handleListKeys(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.resume-record') ?? [])
    let next = Math.max(0, buttons.indexOf(event.target as HTMLButtonElement))
    if (event.key === 'ArrowDown') next = (next + 1) % buttons.length
    if (event.key === 'ArrowUp') next = (next - 1 + buttons.length) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    buttons[next]?.focus()
  }

  return (
    <main className="content-page resume-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="resume-header">
        <button className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <div className="resume-identity">
          <div className="resume-introduction">
            <p className="resume-eyebrow">THE WORK BEHIND THE PERSONA</p>
            <h1 ref={headingRef} tabIndex={-1}>RÉSUMÉ<span>.</span></h1>
            <h2>{profile.title}</h2>
            <p className="resume-specialties">{profile.subtitle}</p>
            {profile.summary && <p className="resume-summary">{profile.summary}</p>}
            <div className="resume-profile-tags">
              {profile.tags.map(tag => <span key={tag}>{tag}</span>)}
              {profile.link && <a href={profile.link} target="_blank" rel="noreferrer">GITHUB ↗</a>}
            </div>
          </div>
          <div className="resume-hero-aside">
            {characterImage && <img className="resume-hero-character" src={`${import.meta.env.BASE_URL}image/character/${encodeURIComponent(characterImage)}`} alt="" />}
            <div className="resume-counts">
              <span><strong>{count('experience')}</strong> PROFESSIONAL ROLES</span>
              <span><strong>{count('projects')}</strong> PROJECTS</span>
              <span><strong>{count('education')}</strong> ACADEMIC RECORDS</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="resume-categories" aria-label="Resume categories">
        {categories.map((item, index) => (
          <button key={item.id} className={category === item.id ? 'is-active' : ''} aria-pressed={category === item.id} onClick={() => chooseCategory(item.id)}>
            <span>{String(index + 1).padStart(2, '0')}</span>{item.label}<small>{count(item.id)}</small>
          </button>
        ))}
      </nav>

      <div className="resume-workspace">
        <aside className="resume-index">
          <div className="resume-index-heading"><span>{categoryLabel}</span><span>{visible.length} {visible.length === 1 ? 'FILE' : 'FILES'}</span></div>
          <label className="resume-search"><span>FIND AN ENTRY</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, tools, or results" /></label>
          <nav ref={listRef} className="resume-records" aria-label={`${categoryLabel.toLowerCase()} entries`} onKeyDown={handleListKeys}>
            {visible.map((entry, index) => (
              <button key={entry.id} className={`resume-record${selected?.id === entry.id ? ' is-active' : ''}`} aria-pressed={selected?.id === entry.id} onClick={() => chooseEntry(entry)}>
                <span className="resume-record-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="resume-record-copy"><strong>{category === 'experience' || category === 'education' ? entry.subtitle : entry.title}</strong><span>{category === 'experience' || category === 'education' ? entry.title : entry.subtitle}</span>{entry.period && <small>{entry.period}</small>}</span>
                <span className="resume-record-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          {!visible.length && <p className="resume-empty">No entries match this search. <button onClick={() => setQuery('')}>Clear search</button></p>}
          <p className="resume-index-hint"><kbd>↑</kbd> <kbd>↓</kbd> BROWSE <kbd>↵</kbd> OPEN</p>
        </aside>

        <section className="resume-detail-slot" aria-label="Resume entry details">
          {selected ? (
            <article key={selected.id} className="resume-detail" aria-labelledby="resume-detail-title">
              <div className="resume-detail-strip"><span>★ {categoryLabel}</span><span>FILE {String(visible.indexOf(selected) + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')}</span></div>
              <div className="resume-detail-content">
                {selected.subtitle && <p className="resume-detail-subtitle">{selected.subtitle}</p>}
                <h2 id="resume-detail-title" ref={detailRef} tabIndex={-1}>{selected.title}</h2>
                {(selected.period || selected.location) && <p className="resume-dates">{selected.period && <span>{selected.period}</span>}{selected.location && <span>{selected.location}</span>}</p>}
                {selected.summary && <p className="resume-entry-summary">{selected.summary}</p>}
                {!!selected.bullets.length && <ul className="resume-bullets">{selected.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>}
                {selected.highlight && <aside className="resume-result"><span>RESULT / IN CONTEXT</span><p>{selected.highlight}</p></aside>}
                {!!selected.tags.length && <div className="resume-tools"><h3>TOOLS & CONTEXT</h3><div>{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>}
                {selected.link && <a className="resume-entry-link" href={selected.link} target="_blank" rel="noreferrer">VIEW PROJECT ↗</a>}
                {category === 'education' && count('coursework') > 0 && <button className="utility-button resume-coursework-link" onClick={() => chooseCategory('coursework')}>EXPLORE COURSEWORK →</button>}
              </div>
              <footer className="resume-detail-footer">
                {footerImages[selected.id] && <img src={`${import.meta.env.BASE_URL}image/character%20confidant%20icon/${encodeURIComponent(footerImages[selected.id]!)}`} alt="" />}
                <div><span>{profile.title.toUpperCase()}</span><p>THE RECORD CONTINUES.</p></div>
                <span className="resume-footer-star" aria-hidden="true">★</span>
              </footer>
            </article>
          ) : <div className="resume-no-detail"><span aria-hidden="true">★</span><p>Try another search to uncover a file.</p></div>}
        </section>
      </div>
    </main>
  )
}
