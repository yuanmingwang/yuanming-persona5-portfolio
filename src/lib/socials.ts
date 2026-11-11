import Papa from 'papaparse'
import { assignImages } from './about.ts'

export type SocialChannel = {
  id: string
  order: number
  label: string
  kicker: string
  handle: string
  url: string
  title: string
  description: string
  actionLabel: string
  icon: string
  confidantImage: string
  topics: string[]
}

export function validateSocialUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol === 'https:') return url.href
  if (url.protocol === 'mailto:' && /^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(url.pathname) && !url.search && !url.hash) return url.href
  throw new Error('Social links must be HTTPS URLs or a plain mailto email address.')
}

export function socialCopyValue(url: string): string {
  return url.startsWith('mailto:') ? new URL(url).pathname : url
}

export function parseSocials(csv: string): SocialChannel[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: value => value.trim().toLowerCase(),
    transform: value => value.trim(),
  })
  if (result.errors.length || !['id', 'order', 'label', 'url', 'title', 'icon'].every(column => result.meta.fields?.includes(column))) {
    throw new Error('Socials CSV needs id, order, label, url, title, and icon.')
  }
  const ids = new Set<string>()
  const channels = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || ids.has(row.id) || !row.order || !Number.isFinite(order) || !row.label || !row.title || !row.icon) {
      throw new Error('Socials rows need unique IDs, numeric order, a label, a title, and an icon.')
    }
    ids.add(row.id)
    const url = validateSocialUrl(row.url)
    return {
      id: row.id,
      order,
      label: row.label,
      kicker: row.kicker ?? '',
      handle: row.handle || socialCopyValue(url),
      url,
      title: row.title,
      description: row.description ?? '',
      actionLabel: row.action_label || 'OPEN LINK',
      icon: row.icon,
      confidantImage: row.confidant_image ?? '',
      topics: (row.topics ?? '').split('|').map(value => value.trim()).filter(Boolean),
    }
  })
  if (!channels.length) throw new Error('Socials CSV is empty.')
  return channels.sort((a, b) => a.order - b.order)
}

// Reuse About's no-repeat matching, with a new draw for each Socials visit.
export function assignSocialImages(channels: SocialChannel[], files: string[], random = Math.random): SocialChannel[] {
  const portraits = assignImages(files, channels.map(channel => channel.confidantImage), random)
  return channels.map((channel, index) => ({ ...channel, confidantImage: portraits[index] ?? '' }))
}
