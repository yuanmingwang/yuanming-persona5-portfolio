import csv from '../content/persona - Resume.csv?raw'
import { parseResume } from './resume'
import type { ResumeEntry } from './resume'

export const localResume = parseResume(csv)

export async function loadResume(signal: AbortSignal): Promise<ResumeEntry[]> {
  const url = import.meta.env.VITE_RESUME_CSV_URL?.trim()
  if (!url) return localResume
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Resume request failed: ${response.status}`)
  return parseResume(await response.text())
}
