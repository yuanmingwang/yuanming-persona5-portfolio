// Pure navigation rules shared by the page-level keyboard hook and its tests.
export function menuNavigationIndex(key: string, currentIndex: number, count: number): number | undefined {
  if (count < 1) return undefined
  const current = Math.max(0, Math.min(currentIndex, count - 1))
  if (key === 'ArrowDown') return (current + 1) % count
  if (key === 'ArrowUp') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return undefined
}

type KeyContext = {
  defaultPrevented?: boolean
  isComposing?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export function ignoreMenuKey(event: KeyContext, editable: boolean): boolean {
  return editable || !!(event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
}
