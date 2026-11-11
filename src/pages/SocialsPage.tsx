import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import PageBackground from '../components/PageBackground'
import images from '../content/about-images.json'
import { assignSocialImages, socialCopyValue } from '../lib/socials'
import type { SocialChannel } from '../lib/socials'
import '../styles/SocialsPage.css'

type SocialsPageProps = {
  channels: SocialChannel[]
  backgroundVideo?: string
  headingRef: Ref<HTMLHeadingElement>
  onBack: () => void
  navigationDisabled?: boolean
}

function assetUrl(folder: string, filename: string) {
  return `${import.meta.env.BASE_URL}image/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`
}

export default function SocialsPage({ channels: items, backgroundVideo, headingRef, onBack, navigationDisabled = false }: SocialsPageProps) {
  const [channels] = useState(() => assignSocialImages(items, images.confidant))
  const [selectedId, setSelectedId] = useState(channels[0].id)
  const [revealed, setRevealed] = useState(false)
  const [copyStatus, setCopyStatus] = useState<{ id: string; message: string } | null>(null)
  const menuRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const selectedIndex = Math.max(0, channels.findIndex(channel => channel.id === selectedId))
  const selected = channels[selectedIndex]
  const isEmail = selected.url.startsWith('mailto:')

  const closeDetail = useCallback(() => {
    setRevealed(false)
    setCopyStatus(null)
    menuRef.current?.querySelectorAll<HTMLButtonElement>('.social-channel')[selectedIndex]?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 900px)').matches) {
      menuRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [selectedIndex])

  useEffect(() => {
    if (!revealed || navigationDisabled) return
    detailRef.current?.querySelector<HTMLHeadingElement>('h2')?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 900px)').matches) {
      detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
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

  function selectChannel(id: string) {
    setSelectedId(id)
    setRevealed(true)
    setCopyStatus(null)
  }

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.social-channel') ?? [])
    let next = Math.max(0, buttons.indexOf(event.target as HTMLButtonElement))
    if (event.key === 'ArrowDown') next = (next + 1) % buttons.length
    if (event.key === 'ArrowUp') next = (next - 1 + buttons.length) % buttons.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    buttons[next]?.focus({ preventScroll: true })
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(socialCopyValue(selected.url))
      setCopyStatus({ id: selected.id, message: isEmail ? 'Email address copied.' : 'Link copied.' })
    } catch {
      setCopyStatus({ id: selected.id, message: 'Could not copy. Select the address above to copy it manually.' })
    }
  }


  return (
    <main className="content-page socials-page">
      <PageBackground key={backgroundVideo} filename={backgroundVideo} />
      <header className="socials-header">
        <button className="utility-button" onClick={onBack}>← BACK TO MENU</button>
        <p className="socials-eyebrow">GOOD CONNECTIONS START SOMEWHERE</p>
        <h1 ref={headingRef} tabIndex={-1}>LET’S <span>CONNECT.</span></h1>
        <p className="socials-intro">Code to explore. Ideas to share. A conversation to start.</p>
      </header>

      <div className="socials-layout">
        <aside className="socials-sidebar">
          <p className="socials-section-label"><span aria-hidden="true">★</span> CHOOSE YOUR CHANNEL <span>{String(channels.length).padStart(2, '0')}</span></p>
          <nav ref={menuRef} className="social-channels" aria-label="Social channels" onKeyDown={handleKeys}>
            {channels.map((channel, index) => (
              <button
                key={channel.id}
                className={`social-channel${selected.id === channel.id ? ' is-active' : ''}`}
                aria-expanded={revealed && selected.id === channel.id}
                aria-controls="social-contact-card"
                onClick={() => selectChannel(channel.id)}
              >
                <img src={assetUrl('icon', channel.icon)} alt="" />
                <span className="social-channel-copy"><span>{String(index + 1).padStart(2, '0')} / {channel.kicker}</span><strong>{channel.label}</strong></span>
                <span className="social-channel-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
          <p className="socials-key-hint"><kbd>↑</kbd> <kbd>↓</kbd> SELECT <kbd>↵</kbd> VIEW</p>
          <div className="socials-side-note"><span>TAKE YOUR TIME.</span><p>Pick a channel. Let’s make a connection.</p></div>
        </aside>

        <section id="social-contact-card" ref={detailRef} className="social-detail-slot" aria-label="Selected contact channel">
          {revealed ? <>
            <article key={selected.id} className="social-contact-card" aria-labelledby="social-contact-title">
              <div className="social-card-strip"><span>{selected.kicker}</span><span>CHANNEL {String(selectedIndex + 1).padStart(2, '0')} / {String(channels.length).padStart(2, '0')}</span><button className="social-close" onClick={closeDetail} aria-label="Close contact details">CLOSE ×</button></div>
              <div className="social-card-content">
                <div className="social-card-heading">
                  <div><p>{selected.label}</p><h2 id="social-contact-title" tabIndex={-1}>{selected.title}</h2></div>
                  <img src={assetUrl('icon', selected.icon)} alt="" />
                </div>
                <p className="social-address">{selected.handle}</p>
                {selected.description && <p className="social-description">{selected.description}</p>}
                {!!selected.topics.length && <div className="social-topics">{selected.topics.map((topic, index) => <span key={index}>{topic}</span>)}</div>}
                <div className="social-actions">
                  <a className="social-open" href={selected.url} target={isEmail ? undefined : '_blank'} rel={isEmail ? undefined : 'noreferrer'}>{selected.actionLabel}<span aria-hidden="true">↗</span></a>
                  <button className="utility-button social-copy" onClick={copyAddress}>{isEmail ? 'COPY EMAIL' : 'COPY LINK'}</button>
                </div>
                <p className="social-action-status" role="status">{copyStatus?.id === selected.id ? copyStatus.message : isEmail ? 'Opens your email app.' : 'Opens the profile in a new tab.'}</p>
              </div>
              <footer className="social-card-footer">
                {selected.confidantImage && <img src={assetUrl('character_confidant_icon', selected.confidantImage)} alt="" />}
                <div><span>THE NEXT CONNECTION</span><p>Every good story starts with a conversation.</p></div>
                <span className="social-footer-star" aria-hidden="true">★</span>
              </footer>
            </article>
            <button className="utility-button social-return" onClick={closeDetail}>CLOSE & CHOOSE ANOTHER ↑</button>
          </> : (
            <div className="social-invitation">
              <img src={assetUrl('icon', 'persona5_message_icon_256.webp')} alt="" />
              <p>EVERY CONNECTION</p>
              <strong>STARTS WITH HELLO.</strong>
              <span>OPEN A CHANNEL TO START THE CONVERSATION.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
