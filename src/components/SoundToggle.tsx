import { useEffect, useRef, useState } from 'react'

// The array order is the playback order. After track 4, return to track 1.
const tracks = [
  { title: 'LIFE WILL CHANGE', file: '1._Life_Will_Change.mp3' },
  { title: 'LAST SURPRISE', file: '2._Last_Surprise.mp3' },
  { title: 'BENEATH THE MASK', file: '3._Beneath_the_Mask.mp3' },
  { title: 'RIVERS IN THE DESERT', file: '4._Rivers_in_the_Desert.mp3' },
]

// Audio stays mounted while App switches between the menu and a page.
export default function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const wantsPlayback = useRef(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const track = tracks[trackIndex]

  // React updates the audio src first; then resume the new song if sound was on.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !wantsPlayback.current) return
    let cancelled = false
    audio.volume = 0.5
    audio.play().catch(reason => {
      if (!cancelled && reason.name !== 'AbortError') {
        wantsPlayback.current = false
        setError(true)
      }
    })
    return () => { cancelled = true }
  }, [trackIndex])

  async function toggleSound() {
    const audio = audioRef.current
    if (!audio) return
    if (wantsPlayback.current) {
      wantsPlayback.current = false
      audio.pause()
      return
    }
    wantsPlayback.current = true
    audio.volume = 0.3
    try {
      await audio.play()
      setError(false)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      wantsPlayback.current = false
      setError(true)
    }
  }

  function nextTrack() {
    setError(false)
    setTrackIndex(index => (index + 1) % tracks.length)
  }

  return (
    <div className="sound-control">
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/${track.file}`}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={nextTrack}
        onError={() => { wantsPlayback.current = false; setPlaying(false); setError(true) }}
      />
      <div className="sound-buttons">
        <button className="utility-button sound-button" onClick={toggleSound} aria-pressed={playing}>
          <span aria-hidden="true">{playing ? '♫' : '♪'}</span> SOUND {playing ? 'ON' : 'OFF'}
        </button>
        <button className="utility-button next-track-button" onClick={nextTrack} aria-label="Next track">
          NEXT <span aria-hidden="true">▶▶</span>
        </button>
      </div>
      <span className="sound-caption" role="status">
        {error ? 'Audio unavailable. Try Sound or Next.' : `${trackIndex + 1} / ${tracks.length} — ${track.title}`}
      </span>
    </div>
  )
}
