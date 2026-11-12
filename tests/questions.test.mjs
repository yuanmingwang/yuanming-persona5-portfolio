import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseQuestions, assignQuestionImages } from '../src/lib/questions.ts'

const csv = readFileSync(new URL('../src/content/persona - Questions.csv', import.meta.url), 'utf8')
test('local Questions CSV has complete answers and preserves quoted punctuation', () => {
  const rows = parseQuestions(csv)
  assert.equal(rows.length, 6)
  assert.ok(rows.every(row => row.answer && row.question && row.topic))
  assert.match(rows.find(row => row.id === 'tools').answer, /C\+\+, C#, Python/)
})
test('Questions validates IDs, order, required answers, and quoted multiline cells', () => {
  const header = 'id,order,topic,question,answer,character_image\n'
  const row = 'a,2,Work,What?,"First, answer.\n\nSecond paragraph.",makoto\n'
  assert.equal(parseQuestions(header + row)[0].answer, 'First, answer.\n\nSecond paragraph.')
  assert.throws(() => parseQuestions(header + row + row))
  assert.throws(() => parseQuestions(header + 'a,no,Work,What?,Answer,\n'))
  assert.throws(() => parseQuestions(header + 'a,1,Work,What?,,\n'))
  assert.throws(() => parseQuestions(header))
  assert.throws(() => parseQuestions('id,order\na,1'))
  assert.deepEqual(parseQuestions(header + row + 'b,1,Life,Where?,Here,\n').map(row => row.id), ['b', 'a'])
})
test('per-visit portraits respect names, avoid duplicates, and can change on a later visit', () => {
  const rows = parseQuestions(csv).slice(0, 3)
  rows[1].characterImageQuery = 'MAKOTO'
  const files = ['ann.png', 'makoto_1.webp', 'makoto_2.webp', 'joker.png']
  const first = assignQuestionImages(rows, files, () => 0)
  const second = assignQuestionImages(rows, files, () => .99)
  assert.match(first[1].characterImage, /makoto/)
  assert.equal(new Set(first.map(row => row.characterImage)).size, 3)
  assert.notDeepEqual(first.map(row => row.characterImage), second.map(row => row.characterImage))
  rows[0].characterImageQuery = 'missing'
  assert.equal(assignQuestionImages(rows, files)[0].characterImage, undefined)
})
