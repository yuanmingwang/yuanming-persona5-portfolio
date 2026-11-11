import { useEffect, useRef, useState } from 'react'
import { loadMenu, localMenu } from './lib/content'
import HomePage from './pages/HomePage'
import SoundToggle from './components/SoundToggle'
import './styles/App.css'

function App() {
  const [menu, setMenu] = useState(localMenu)
  const [currentPage, setCurrentPage] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadMenu(controller.signal).then(setMenu).catch(error => {
      if (!controller.signal.aborted) {
        console.warn('Using local menu CSV because the remote menu could not load.', error)
      }
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (currentPage !== null) headingRef.current?.focus()
  }, [currentPage])

  const page = menu.find(item => item.id === currentPage)

  return (
    <>
      {currentPage === null ? (
        <HomePage items={menu} onSelect={setCurrentPage} />
      ) : (
        <main className="content-page">
          <button className="utility-button" onClick={() => setCurrentPage(null)}>← BACK TO MENU</button>
          <p className="eyebrow">THE NEXT CHAPTER</p>
          <h1 ref={headingRef} tabIndex={-1}>{page?.label}</h1>
          <p>tododo</p>
        </main>
      )}
      <SoundToggle />
    </>
  )
}

export default App
