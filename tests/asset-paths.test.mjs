import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const root = fileURLToPath(new URL('../', import.meta.url))
const publicPath = path => `${root}public/${path}`
const read = path => readFileSync(`${root}${path}`, 'utf8')
const rows = name => Papa.parse(read(`src/content/persona - ${name}.csv`), { header: true, skipEmptyLines: true }).data
function files(folder) { return readdirSync(publicPath(folder)).filter(name => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(name)).sort() }
function assertFile(path) { assert.ok(existsSync(publicPath(path)), `Missing asset: ${path}`) }
function assertQuery(folder, value) {
  if (!value?.trim()) return
  assert.ok(files(folder).some(name => name.toLowerCase().includes(value.trim().toLowerCase())), `No image matches ${value} in ${folder}`)
}

test('media asset filenames and folders contain no spaces', () => {
  function walk(folder) {
    for (const entry of readdirSync(publicPath(folder), { withFileTypes: true })) {
      assert.ok(!entry.name.includes(' '), `Spaces remain in ${folder}/${entry.name}`)
      if (entry.isDirectory()) walk(`${folder}/${entry.name}`)
    }
  }
  for (const folder of ['video', 'audio', 'image']) walk(folder)
})

test('generated image index matches renamed public image directories', () => {
  const manifest = JSON.parse(read('src/content/about-images.json'))
  for (const [key, folder] of Object.entries({ menu: 'menu', character: 'character', confidant: 'character_confidant_icon' })) {
    assert.deepEqual(manifest[key], files(`image/${folder}`))
  }
})

test('CSV background, icon, and portrait references resolve to real assets', () => {
  for (const row of rows('Menu')) if (row.page_background_video) assertFile(`video/${row.page_background_video}`)
  for (const row of rows('Journey')) {
    assertFile(`image/icon/${row.icon}`)
    if (row.landmark_image) assertFile(`image/icon/${row.landmark_image}`)
  }
  for (const row of rows('Socials')) {
    assertFile(`image/icon/${row.icon}`)
    assertQuery('image/character_confidant_icon', row.confidant_image)
  }
  for (const row of rows('About')) {
    assertQuery('image/menu', row.menu_image)
    assertQuery('image/character', row.detail_character_image)
  }
  for (const row of rows('Questions')) assertQuery('image/character', row.character_image)
  for (const row of rows('Resume')) {
    if (row.section === 'profile') assertQuery('image/character', row.image)
    assertQuery('image/character_confidant_icon', row.confidant_image)
  }
})

test('hard-coded homepage, stinger, playlist, and invitation assets exist', () => {
  for (const path of ['src/pages/HomePage.tsx', 'src/components/PageTransition.tsx']) {
    const match = read(path).match(/video\/([^`]+)`/)
    assert.ok(match, `No video source found in ${path}`)
    assertFile(`video/${match[1]}`)
  }
  const tracks = [...read('src/components/SoundToggle.tsx').matchAll(/file: '([^']+)'/g)]
  assert.ok(tracks.length > 0)
  for (const [, filename] of tracks) assertFile(`audio/${filename}`)
  for (const [, folder, filename] of read('src/pages/SocialsPage.tsx').matchAll(/assetUrl\('([^']+)', '([^']+)'\)/g)) {
    assertFile(`image/${folder}/${filename}`)
  }
})
