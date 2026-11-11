import csv from '../content/persona - Journey.csv?raw'
import { parseJourney } from './journey'
import type { JourneyChapter } from './journey'

export const localJourney = parseJourney(csv)

export async function loadJourney(signal: AbortSignal): Promise<JourneyChapter[]> {
  const url = import.meta.env.VITE_JOURNEY_CSV_URL?.trim()
  if (!url) return localJourney
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Journey request failed: ${response.status}`)
  return parseJourney(await response.text())
}
