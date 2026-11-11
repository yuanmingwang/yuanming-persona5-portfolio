import { useRef, useState } from 'react'

// Audio stays mounted while App switches between the menu and a page.
export default function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)

  async function toggleSound() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    audio.volume = 0.5
    try {
      await audio.play()
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="sound-control">
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/1. Life Will Change.mp3`}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => { setPlaying(false); setError(true) }}
      />
      <button className="utility-button sound-button" onClick={toggleSound} aria-pressed={playing}>
        <span aria-hidden="true">{playing ? '♫' : '♪'}</span> SOUND {playing ? 'ON' : 'OFF'}
      </button>
      <span className="sound-caption" role="status">{error ? 'Audio unavailable. Try again.' : playing ? 'LIFE WILL CHANGE' : 'PRESS TO PLAY'}</span>
    </div>
  )
}
