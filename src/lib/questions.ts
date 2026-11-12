import Papa from 'papaparse'
import { assignImages } from './about.ts'

export type Question = {
  id: string
  order: number
  topic: string
  question: string
  answer: string
  characterImageQuery: string
}
export type QuestionWithImage = Question & { characterImage?: string }

export function parseQuestions(csv: string): Question[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true, skipEmptyLines: 'greedy',
    transformHeader: value => value.trim().toLowerCase(),
    transform: value => value.trim(),
  })
  if (result.errors.length || !['id', 'order', 'topic', 'question', 'answer'].every(key => result.meta.fields?.includes(key))) {
    throw new Error('Questions CSV needs id, order, topic, question, and answer columns.')
  }
  const ids = new Set<string>()
  const questions = result.data.map(row => {
    const order = Number(row.order)
    if (!row.id || ids.has(row.id) || !row.order || !Number.isFinite(order) || !row.topic || !row.question || !row.answer) {
      throw new Error('Questions need unique IDs, numeric order, a topic, question, and answer.')
    }
    ids.add(row.id)
    return { id: row.id, order, topic: row.topic, question: row.question, answer: row.answer, characterImageQuery: row.character_image ?? '' }
  })
  if (!questions.length) throw new Error('Questions CSV is empty.')
  return questions.sort((a, b) => a.order - b.order)
}

export function assignQuestionImages(questions: Question[], files: string[], random = Math.random): QuestionWithImage[] {
  const images = assignImages(files, questions.map(question => question.characterImageQuery), random)
  return questions.map((question, index) => ({ ...question, characterImage: images[index] }))
}
