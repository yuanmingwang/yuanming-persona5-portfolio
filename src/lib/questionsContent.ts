import csv from '../content/persona - Questions.csv?raw'
import images from '../content/about-images.json'
import { assignQuestionImages, parseQuestions } from './questions'
import type { Question } from './questions'

export const localQuestions = parseQuestions(csv)
export function createQuestionsVisit(questions: Question[]) {
  return assignQuestionImages(questions, images.character)
}
export async function loadQuestions(signal: AbortSignal): Promise<Question[]> {
  const url = import.meta.env.VITE_QUESTIONS_CSV_URL?.trim()
  if (!url) return localQuestions
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Questions request failed: ${response.status}`)
  return parseQuestions(await response.text())
}
