import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { ignoreMenuKey, menuNavigationIndex } from '../lib/menuKeyboard'

type MenuKeyboardOptions = {
  menuRef: RefObject<HTMLElement | null>
  selector: string
  activeIndex: number
  onMove: (index: number) => void
  disabled: boolean
}

// Listen across the page, since headings and details receive focus on entry/open.
export function useMenuKeyboard({ menuRef, selector, activeIndex, onMove, disabled }: MenuKeyboardOptions) {
  const scrollFrame = useRef<number | null>(null)

  // Keep this cleanup separate from the key listener: selection updates replace
  // that listener, but must not cancel the scroll scheduled for the new item.
  useEffect(() => () => {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
  }, [disabled])

  useEffect(() => {
    if (disabled) return
    function handleKey(event: KeyboardEvent) {
      const menu = menuRef.current
      if (!menu || menu.closest('[inert]')) return
      const target = event.target instanceof Element ? event.target : null
      const editable = !!target?.closest('input, textarea, select, [role="textbox"], [role="combobox"], [role="slider"]') ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (ignoreMenuKey(event, editable)) return
      const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>(selector)).filter(button => !button.disabled)
      if (!buttons.length) return
      const focusedIndex = buttons.findIndex(button => button === target || (target !== null && button.contains(target)))
      const current = focusedIndex >= 0 ? focusedIndex : Math.max(0, activeIndex)
      const next = menuNavigationIndex(event.key, current, buttons.length)
      if (next !== undefined) {
        event.preventDefault()
        onMove(next)
        buttons[next].focus({ preventScroll: true })
        // Wait for updated content/focus effects, then reveal this button in
        // both its scrollable index and the page viewport, moving only as far
        // as necessary. This also handles menus initially below the fold.
        if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
        const button = buttons[next]
        scrollFrame.current = window.requestAnimationFrame(() => {
          scrollFrame.current = null
          if (button.isConnected && menu.contains(button) && !menu.closest('[inert]')) {
            button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
          }
        })
      } else if (event.key === 'Enter' && !target?.closest('button, a, summary, [role="button"]')) {
        // Native Enter still operates buttons/links normally. A heading or the
        // page background instead confirms the highlighted menu entry.
        event.preventDefault()
        buttons[Math.min(current, buttons.length - 1)].click()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [menuRef, selector, activeIndex, onMove, disabled])
}
