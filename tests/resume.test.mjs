import test from 'node:test'
import assert from 'node:assert/strict'
import { assignResumeFooterImages, filterResume, parseResume, safeResumeLink } from '../src/lib/resume.ts'

const header = 'id,section,order,title,subtitle,period,location,summary,bullets,tags,link,highlight,image'
const profile = 'me,profile,1,Name,Developer,,,,,C++|Python,https://github.com/example,,'
const csv = `${header}\n${profile}\nsecond,experience,2,Developer,Studio,2024,Canada,"Built UI, gameplay","First bullet\nSecond bullet",Unity|C#,,,\nfirst,experience,1,Graphics Developer,Client,2025,China,Real-time rendering,,Vulkan|C++,,Measured result,`

test('resume parsing preserves multiline CSV, commas, ordering, and technology tags', () => {
  const entries = parseResume(csv)
  const experience = filterResume(entries, 'experience', '')
  assert.equal(experience[0].id, 'first')
  assert.equal(experience[1].summary, 'Built UI, gameplay')
  assert.deepEqual(experience[1].bullets, ['First bullet', 'Second bullet'])
  assert.deepEqual(experience[0].tags, ['Vulkan', 'C++'])
})

test('search matches tools, results, and employers within the selected category', () => {
  const entries = parseResume(csv)
  assert.equal(filterResume(entries, 'experience', ' VULKAN ')[0].id, 'first')
  assert.equal(filterResume(entries, 'experience', 'measured result')[0].id, 'first')
  assert.equal(filterResume(entries, 'experience', 'studio')[0].id, 'second')
  assert.deepEqual(filterResume(entries, 'projects', 'Vulkan'), [])
  assert.deepEqual(filterResume(entries, 'experience', 'missing'), [])
})

test('invalid schemas and entries fail rather than replacing the fallback data', () => {
  for (const data of [
    'id,title\na,A',
    `${header}\n${profile}`,
    `${csv}\n${profile}`,
    csv.replace('second,experience,2', 'second,unknown,2'),
    csv.replace('second,experience,2', 'second,experience,no'),
    csv.replace('second,experience,2', 'first,experience,2'),
  ]) assert.throws(() => parseResume(data))
})

test('only HTTP/HTTPS links are rendered as external links', () => {
  assert.equal(safeResumeLink('https://github.com/example'), 'https://github.com/example')
  for (const link of ['javascript:alert(1)', 'data:text/html,test', '/private/file', '']) {
    assert.equal(safeResumeLink(link), undefined)
  }
})


test('résumé footer portraits reserve named matches and do not repeat within a category', () => {
  const entries = parseResume(csv).map(entry => ({ ...entry, confidantImage: entry.id === 'first' ? 'MAKOTO' : '' }))
  const portraits = assignResumeFooterImages(entries, ['makoto.jpeg', 'ann.jpeg'], () => 0)
  assert.equal(portraits.first, 'makoto.jpeg')
  assert.equal(portraits.second, 'ann.jpeg')
  assert.equal(portraits.me, undefined)
  assert.deepEqual(assignResumeFooterImages(entries, []), { first: undefined, second: undefined })
})

test('blank résumé footer portraits get a fresh draw each visit', () => {
  const entries = parseResume(csv)
  const files = ['ann.jpeg', 'makoto.jpeg', 'morgana.jpeg']
  assert.notDeepEqual(assignResumeFooterImages(entries, files, () => 0), assignResumeFooterImages(entries, files, () => .999))
})
