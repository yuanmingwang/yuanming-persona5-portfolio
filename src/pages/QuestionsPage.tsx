import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import PageBackground from '../components/PageBackground'
import { useMenuKeyboard } from '../hooks/useMenuKeyboard'
import { createQuestionsVisit } from '../lib/questionsContent'
import type { Question } from '../lib/questions'
import '../styles/QuestionsPage.css'

type QuestionsPageProps = {
  questions: Question[]
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
  navigationDisabled: boolean
}

export default function QuestionsPage({ questions, backgroundVideo, headingRef, onBack, navigationDisabled }: QuestionsPageProps) {
  const [visit] = useState(() => createQuestionsVisit(questions))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const selected = visit[selectedIndex]
  const closeAnswer = useCallback(() => {
    setRevealed(false)
    const button = menuRef.current?.querySelectorAll<HTMLButtonElement>('.question-choice')[selectedIndex]
    button?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 950px)').matches) menuRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }, [selectedIndex])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    detailRef.current?.querySelector<HTMLHeadingElement>('h2')?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 950px)').matches) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [revealed, selectedIndex, navigationDisabled])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeAnswer() }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [revealed, navigationDisabled, closeAnswer])

  useMenuKeyboard({ menuRef, selector: '.question-choice', activeIndex: selectedIndex, onMove: setSelectedIndex, disabled: navigationDisabled })
  function ask(index: number) { setSelectedIndex(index); setRevealed(true) }

  return (
    <main className="content-page questions-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="questions-header">
        <button className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <p className="questions-eyebrow">A LITTLE LESS MYSTERY. A LITTLE MORE ME.</p>
        <h1 ref={headingRef} tabIndex={-1}>ASK <span>AWAY.</span></h1>
        <p className="questions-intro">The person behind the work, one question at a time.</p>
      </header>
      <div className="questions-layout">
        <aside className="questions-index">
          <p className="questions-index-label"><span>★ PICK A CONVERSATION</span><span>{String(visit.length).padStart(2, '0')} QUESTIONS</span></p>
          <nav ref={menuRef} className="questions-list" aria-label="Questions">
            {visit.map((question, index) => (
              <button key={question.id} className={`question-choice${selectedIndex === index ? ' is-active' : ''}`} aria-expanded={revealed && selectedIndex === index} aria-controls="question-answer" onClick={() => ask(index)}>
                <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
                <span><span className="question-topic">{question.topic}</span><strong>{question.question}</strong></span>
                <span className="question-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <p className="questions-key-hint"><kbd>↑</kbd><kbd>↓</kbd> SELECT <kbd>↵</kbd> REVEAL
            {/* <kbd>ESC</kbd> CLOSE */}
          </p>
        </aside>
        <section id="question-answer" ref={detailRef} className="questions-answer-slot" aria-label="Answer">
          {revealed ? (
            <article key={selected.id} className="question-answer" aria-labelledby="question-answer-title">
              <div className="question-answer-strip"><span>LET’S TALK / {selected.topic}</span><button onClick={closeAnswer} aria-label="Close answer">CLOSE ×</button></div>
              <div className="question-answer-body">
                <p className="question-speaker">YUANMING <span>IN CONVERSATION</span></p>
                <h2 id="question-answer-title" tabIndex={-1}>{selected.question}</h2>
                <div className="question-response">{selected.answer.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              </div>
              <div className="question-character-band" aria-hidden="true"><span>BEHIND<br /><strong>THE PERSONA.</strong></span>{selected.characterImage && <img src={`${import.meta.env.BASE_URL}image/character/${encodeURIComponent(selected.characterImage)}`} alt="" />}</div>
              <footer className="question-answer-footer"><button className="utility-button" onClick={() => ask((selectedIndex - 1 + visit.length) % visit.length)}>← PREVIOUS</button><span>{String(selectedIndex + 1).padStart(2, '0')} / {String(visit.length).padStart(2, '0')}</span><button className="utility-button" onClick={() => ask((selectedIndex + 1) % visit.length)}>NEXT →</button></footer>
            </article>
          ) : (
            <div className="questions-invitation">
              <img src={`${import.meta.env.BASE_URL}image/icon/persona5_message_icon_256.webp`} alt="" />
              <p>GOT A QUESTION?</p><strong>LET’S TALK.</strong><span>CHOOSE A QUESTION. GET TO KNOW ME.</span>
              <p className="questions-invitation-note">From the tools I use to the chapters that shaped my work.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
