import Papa from 'papaparse'

export type AboutItem = {
  id: string
  order: number
  menuLabel: string
  menuSubtitle: string
  menuImageQuery: string
  detailTitle: string
  detailDescription: string
  detailHighlight: string
  characterImageQuery: string
}

type AboutRow = Record<string, string>

export function parseAbout(csv: string): AboutItem[] {
  const result = Papa.parse<AboutRow>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: value => value.trim().toLowerCase(),
    transform: value => value.trim(),
  })
  const required = ['id', 'order', 'menu_label', 'detail_title']
  if (result.errors.length || !required.every(column => result.meta.fields?.includes(column))) {
    throw new Error('About CSV needs id, order, menu_label, and detail_title.')
  }
  const ids = new Set<string>()
  const items = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || !row.order || !Number.isFinite(order) || !row.menu_label || !row.detail_title || ids.has(row.id)) {
      throw new Error('Each About row needs a unique id, numeric order, menu label, and detail title.')
    }
    ids.add(row.id)
    return {
      id: row.id,
      order,
      menuLabel: row.menu_label,
      menuSubtitle: row.menu_subtitle ?? '',
      menuImageQuery: row.menu_image ?? '',
      detailTitle: row.detail_title,
      detailDescription: row.detail_description ?? '',
      detailHighlight: row.detail_highlight ?? '',
      characterImageQuery: row.detail_character_image ?? '',
    }
  })
  if (!items.length) throw new Error('About CSV is empty.')
  return items.sort((a, b) => a.order - b.order)
}

export function pickImage(files: string[], query: string, random = Math.random): string | undefined {
  const name = query.trim().toLowerCase()
  const matches = name ? files.filter(file => file.toLowerCase().includes(name)) : files
  if (!matches.length) return undefined
  return matches[Math.floor(random() * matches.length)]
}

export type AboutSection = AboutItem & { menuImage?: string; characterImage?: string }
type ImageCatalog = { menu: string[]; character: string[] }

// Assign each file at most once. Narrow named queries go first so blank rows
// cannot use up an image needed by a specific row. Keep the original row order.
export function assignImages(files: string[], queries: string[], random = Math.random): (string | undefined)[] {
  const available = new Set(files)
  const rows = queries.map((query, index) => ({
    query,
    index,
    matches: [...available].filter(file => file.toLowerCase().includes(query.trim().toLowerCase())).length,
  })).sort((a, b) => Number(!a.query.trim()) - Number(!b.query.trim()) || a.matches - b.matches || a.index - b.index)
  const selected: (string | undefined)[] = Array(queries.length).fill(undefined)
  for (const row of rows) {
    const image = pickImage([...available], row.query, random)
    selected[row.index] = image
    if (image) available.delete(image)
  }
  return selected
}

// Menu portraits and detailed characters have independent no-repeat pools.
export function assignAboutImages(items: AboutItem[], catalog: ImageCatalog, random = Math.random): AboutSection[] {
  const menu = assignImages(catalog.menu, items.map(item => item.menuImageQuery), random)
  const characters = assignImages(catalog.character, items.map(item => item.characterImageQuery), random)
  return items.map((item, index) => ({ ...item, menuImage: menu[index], characterImage: characters[index] }))
}
