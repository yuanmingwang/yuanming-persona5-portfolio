import Papa from 'papaparse'
import menuCsv from '../content/persona - Menu.csv?raw'

export type MenuItem = {
  id: string
  label: string
  order: number
}

type MenuRow = { id: string; label: string; order: string }

// One parser for both the bundled CSV and a published Google Sheet.
export function parseMenu(csv: string): MenuItem[] {
  const result = Papa.parse<MenuRow>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim().toLowerCase(),
    transform: value => value.trim(),
  })

  if (result.errors.length || !['id', 'label', 'order'].every(
    column => result.meta.fields?.includes(column),
  )) {
    throw new Error('Menu CSV needs the columns: id, label, order.')
  }

  const ids = new Set<string>()
  const items = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || !row.label || !row.order || !Number.isFinite(order) || ids.has(row.id)) {
      throw new Error('Each menu row needs a unique id, a label, and a numeric order.')
    }
    ids.add(row.id)
    return { id: row.id, label: row.label, order }
  })

  if (!items.length) throw new Error('Menu CSV is empty.')
  return items.sort((a, b) => a.order - b.order)
}

// Available immediately, even offline or when the remote sheet fails.
export const localMenu = parseMenu(menuCsv)

export async function loadMenu(signal: AbortSignal): Promise<MenuItem[]> {
  const url = import.meta.env.VITE_MENU_CSV_URL?.trim()
  if (!url) return localMenu

  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Menu request failed: ${response.status}`)
  return parseMenu(await response.text())
}
