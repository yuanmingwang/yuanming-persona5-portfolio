import csv from '../content/persona - Socials.csv?raw'
import { parseSocials } from './socials'
import type { SocialChannel } from './socials'

export const localSocials = parseSocials(csv)

export async function loadSocials(signal: AbortSignal): Promise<SocialChannel[]> {
  const url = import.meta.env.VITE_SOCIALS_CSV_URL?.trim()
  if (!url) return localSocials
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Socials request failed: ${response.status}`)
  return parseSocials(await response.text())
}
