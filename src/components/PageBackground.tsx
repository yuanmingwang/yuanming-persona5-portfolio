import { useRef, useState } from 'react'

type PageBackgroundProps = {
  filename?: string
}

// The CSV supplies a filename from public/video, not a full URL.
export default function PageBackground({ filename }: PageBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [unavailable, setUnavailable] = useState(false)

  async function toggleMotion() {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) video.pause()
    else {
      try {
        await video.play()
      } catch {
        setPaused(true)
      }
    }
  }

  // Missing/blank filenames or failed files keep the page's CSS background.
  if (!filename || unavailable) return null

  return (
    <>
      <video
        ref={videoRef}
        className="content-background-video"
        src={`${import.meta.env.BASE_URL}video/${encodeURIComponent(filename)}`}
        autoPlay={!paused}
        muted
        loop
        playsInline
        aria-hidden="true"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => setUnavailable(true)}
      />
      <div className="content-background-shade" aria-hidden="true" />
      <button
        className="utility-button content-motion-button"
        onClick={toggleMotion}
        aria-pressed={paused}
      >
        {paused ? 'PLAY BACKGROUND' : 'PAUSE BACKGROUND'}
      </button>
    </>
  )
}
