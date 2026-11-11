import aboutCsv from '../content/persona - About.csv?raw'
import images from '../content/about-images.json'
import { assignAboutImages, parseAbout } from './about'
import type { AboutItem } from './about'

// Keep loaded content separate from the images chosen for a page visit.
export const localAbout = parseAbout(aboutCsv)

export function createAboutVisit(items: AboutItem[]) {
  return assignAboutImages(items, images)
}

export async function loadAbout(signal: AbortSignal): Promise<AboutItem[]> {
  const url = import.meta.env.VITE_ABOUT_CSV_URL?.trim()
  if (!url) return localAbout
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`About request failed: ${response.status}`)
  return parseAbout(await response.text())
}
