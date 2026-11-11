import Papa from 'papaparse'

export type JourneyType = 'education' | 'experience' | 'location'
export type JourneyFilter = 'all' | 'education' | 'experience'
export type JourneyChapter = {
  id: string
  order: number
  year: string
  period: string
  type: JourneyType
  title: string
  organization: string
  city: string
  country: string
  description: string
  highlights: string[]
  icon: string
  landmarkImage: string
  topics: string[]
}

export const journeyTypeLabels: Record<JourneyType, string> = {
  education: 'LEARNING', experience: 'BUILDING', location: 'CURRENT LOCATION',
}

export function parseJourney(csv: string): JourneyChapter[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: value => value.trim().toLowerCase(),
    transform: value => value.trim(),
  })
  const required = ['id', 'order', 'year', 'period', 'type', 'title', 'organization', 'city', 'country', 'description', 'icon']
  if (result.errors.length || !required.every(column => result.meta.fields?.includes(column))) {
    throw new Error('Journey CSV is missing required chapter columns.')
  }
  const ids = new Set<string>()
  const chapters = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || ids.has(row.id) || !row.order || !Number.isFinite(order) ||
      !['education', 'experience', 'location'].includes(row.type) ||
      !['year', 'period', 'title', 'organization', 'city', 'country', 'description', 'icon'].every(key => row[key])) {
      throw new Error('Journey chapters need unique IDs, numeric order, a valid type, and complete chapter details.')
    }
    ids.add(row.id)
    return {
      id: row.id, order, year: row.year, period: row.period,
      type: row.type as JourneyType,
      title: row.title, organization: row.organization, city: row.city, country: row.country,
      description: row.description,
      highlights: (row.highlights ?? '').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      icon: row.icon, landmarkImage: row.landmark_image || row.icon,
      topics: (row.topics ?? '').split('|').map(value => value.trim()).filter(Boolean),
    }
  })
  if (!chapters.length) throw new Error('Journey CSV is empty.')
  return chapters.sort((a, b) => a.order - b.order)
}

export function filterJourney(chapters: JourneyChapter[], filter: JourneyFilter): JourneyChapter[] {
  return filter === 'all' ? chapters : chapters.filter(chapter => chapter.type === filter)
}
