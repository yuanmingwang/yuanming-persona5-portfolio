import test from 'node:test'
import assert from 'node:assert/strict'
import { assignAboutImages, assignImages, parseAbout, pickImage } from '../src/lib/about.ts'

const header = 'id,order,menu_label,menu_subtitle,menu_image,detail_title,detail_description,detail_highlight,detail_character_image'

test('About CSV preserves quoted commas and multiline text, and sorts by order', () => {
  const items = parseAbout(`${header}\r\nwork,2,WORK,WHAT I DO,,"Developer, Engineer","Line one\nLine two",Focus,\r\nprofile,1,PROFILE,WHO I AM, lavenza ,Yuanming Wang,Description,Highlight,Lavenza`)
  assert.equal(items[0].id, 'profile')
  assert.equal(items[0].menuImageQuery, 'lavenza')
  assert.equal(items[1].detailTitle, 'Developer, Engineer')
  assert.equal(items[1].detailDescription, 'Line one\nLine two')
  assert.equal(items[1].characterImageQuery, '')
})

test('About CSV rejects malformed content before replacing local fallback data', () => {
  for (const csv of [
    'id,order,menu_label\na,1,PROFILE',
    header,
    `${header}\na,1,A,,,Title,,,\na,2,B,,,Title,,,`,
    `${header}\na,not-a-number,A,,,Title,,,`,
  ]) assert.throws(() => parseAbout(csv))
})

test('named image queries choose only case-insensitive substring matches', () => {
  const files = ['ann_1.png', 'Lavenza_1.png', 'lavenza_2.png', 'joker.png']
  assert.equal(pickImage(files, ' LAVENZA ', () => 0), 'Lavenza_1.png')
  assert.equal(pickImage(files, 'lavenza', () => .999), 'lavenza_2.png')
  assert.equal(pickImage(files, 'ann_1.png', () => .5), 'ann_1.png')
})

test('blank queries pick from the whole folder; no matches or empty folders omit the image', () => {
  const files = ['ann.png', 'joker.png']
  assert.equal(pickImage(files, '', () => 0), 'ann.png')
  assert.equal(pickImage(files, '  ', () => .999), 'joker.png')
  assert.equal(pickImage(files, 'not-present'), undefined)
  assert.equal(pickImage([], ''), undefined)
})


test('image assignment never repeats a file and reserves named matches before blank rows', () => {
  assert.deepEqual(assignImages(['lavenza.png', 'joker.png', 'ann.png'], ['', 'lavenza', ''], () => 0),
    ['joker.png', 'lavenza.png', 'ann.png'])
  assert.deepEqual(assignImages(['lavenza_1.png', 'lavenza_2.png'], ['lavenza', 'lavenza_1.png'], () => 0),
    ['lavenza_2.png', 'lavenza_1.png'])
})

test('exhausted, unmatched, and empty image pools omit images instead of duplicating', () => {
  assert.deepEqual(assignImages(['ann.png'], ['ann', 'ann', ''], () => 0), ['ann.png', undefined, undefined])
  assert.deepEqual(assignImages([], ['', 'lavenza']), [undefined, undefined])
  assert.deepEqual(assignImages(['ann.png', 'ann.png'], ['', '']), ['ann.png', undefined])
})

test('each visit draws afresh with separate unique menu and character pools', () => {
  const items = parseAbout(`${header}\na,1,A,,,A,,,\nb,2,B,,,B,,,`)
  const catalog = { menu: ['a.png', 'b.png', 'c.png'], character: ['a.png', 'b.png', 'c.png'] }
  const first = assignAboutImages(items, catalog, () => 0)
  const second = assignAboutImages(items, catalog, () => .999)
  for (const visit of [first, second]) {
    assert.equal(new Set(visit.map(item => item.menuImage)).size, 2)
    assert.equal(new Set(visit.map(item => item.characterImage)).size, 2)
  }
  assert.notDeepEqual(first.map(item => item.menuImage), second.map(item => item.menuImage))
  assert.notDeepEqual(first.map(item => item.characterImage), second.map(item => item.characterImage))
  assert.equal(items[0].menuImage, undefined) // Loaded CSV data remains untouched.
})
