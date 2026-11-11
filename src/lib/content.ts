import Papa from 'papaparse'
import menuCsv from '../content/persona - Menu.csv?raw'

export type MenuItem = {
  id: string
  label: string
  order: number
  pageBackgroundVideo?: string
}

type MenuRow = {
  id: string
  order: string
  menu_label?: string
  label?: string // Backward compatibility with the original CSV.
  page_background_video?: string
}

// One parser for both the bundled CSV and a published Google Sheet.
export function parseMenu(csv: string): MenuItem[] {
  const result = Papa.parse<MenuRow>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim().toLowerCase(),
    transform: value => value.trim(),
  })

  const fields = result.meta.fields ?? []
  if (result.errors.length || !['id', 'order'].every(column => fields.includes(column)) ||
    !fields.some(column => column === 'menu_label' || column === 'label')) {
    throw new Error('Menu CSV needs id, order, and menu_label (or label).')
  }

  const ids = new Set<string>()
  const items = result.data.map(row => {
    const order = Number(row.order)
    const label = row.menu_label || row.label
    if (!row.id || !label || !row.order || !Number.isFinite(order) || ids.has(row.id)) {
      throw new Error('Each menu row needs a unique id, a label, and a numeric order.')
    }
    ids.add(row.id)
    return {
      id: row.id,
      label,
      order,
      pageBackgroundVideo: row.page_background_video || undefined,
    }
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
