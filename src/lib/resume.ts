import Papa from 'papaparse'
import { assignImages } from './about.ts'

export const resumeCategories = [
  { id: 'education', label: 'EDUCATION' },
  { id: 'experience', label: 'EXPERIENCE' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'coursework', label: 'COURSEWORK' },
] as const

export type ResumeCategory = typeof resumeCategories[number]['id']
export type ResumeEntry = {
  id: string
  section: ResumeCategory | 'profile'
  order: number
  title: string
  subtitle: string
  period: string
  location: string
  summary: string
  bullets: string[]
  tags: string[]
  link?: string
  highlight: string
  image: string
  confidantImage?: string
}

export function safeResumeLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

export function parseResume(csv: string): ResumeEntry[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: value => value.trim().toLowerCase(),
    transform: value => value.trim(),
  })
  if (result.errors.length || !['id', 'section', 'order', 'title'].every(column => result.meta.fields?.includes(column))) {
    throw new Error('Resume CSV needs id, section, order, and title.')
  }
  const ids = new Set<string>()
  const allowed: string[] = ['profile', ...resumeCategories.map(category => category.id)]
  const entries = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || ids.has(row.id) || !row.title || !row.order || !Number.isFinite(order) || !allowed.includes(row.section)) {
      throw new Error('Resume rows need unique IDs, valid sections, numeric order, and titles.')
    }
    ids.add(row.id)
    const tags = row.tags ?? ''
    return {
      id: row.id,
      section: row.section as ResumeEntry['section'],
      order,
      title: row.title,
      subtitle: row.subtitle ?? '',
      period: row.period ?? '',
      location: row.location ?? '',
      summary: row.summary ?? '',
      bullets: (row.bullets ?? '').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      tags: tags.split(tags.includes('|') ? '|' : ',').map(value => value.trim()).filter(Boolean),
      link: safeResumeLink(row.link ?? ''),
      highlight: row.highlight ?? '',
      image: row.image ?? '',
      confidantImage: row.confidant_image ?? '',
    }
  })
  if (entries.filter(entry => entry.section === 'profile').length !== 1 || entries.length < 2) {
    throw new Error('Resume CSV needs exactly one profile row and at least one other entry.')
  }
  return entries.sort((a, b) => a.order - b.order)
}

export function filterResume(entries: ResumeEntry[], category: ResumeCategory, query: string): ResumeEntry[] {
  const search = query.trim().toLowerCase()
  return entries.filter(entry => entry.section === category &&
    [entry.title, entry.subtitle, entry.summary, entry.period, entry.location, ...entry.tags, ...entry.bullets, entry.highlight]
      .join(' ').toLowerCase().includes(search))
}

// Choose once per page visit. Keep portraits unique within each category;
// separate categories can reuse files because the résumé has more records
// than the confidant folder has images.
export function assignResumeFooterImages(entries: ResumeEntry[], files: string[], random = Math.random): Record<string, string | undefined> {
  const selected: Record<string, string | undefined> = {}
  for (const category of resumeCategories) {
    const records = entries.filter(entry => entry.section === category.id)
    const portraits = assignImages(files, records.map(entry => entry.confidantImage ?? ''), random)
    records.forEach((entry, index) => { selected[entry.id] = portraits[index] })
  }
  return selected
}
