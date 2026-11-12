import test from 'node:test'
import assert from 'node:assert/strict'
import { assignSocialImages, parseSocials, socialCopyValue, validateSocialUrl } from '../src/lib/socials.ts'

const header = 'id,order,label,kicker,handle,url,title,description,action_label,icon,confidant_image,topics'
const csv = `${header}\nmail,2,GMAIL,CONTACT,test@example.com,mailto:test@example.com,HELLO,"Projects, ideas",WRITE,p5_gmail_icon.png,morgana_confidant.jpeg,Projects|Ideas\ngithub,1,GITHUB,CODE,github.com/example,https://github.com/example,BUILDS,Description,OPEN,p5_github_icon.png,,Code`

test('social CSV handles quoted commas, topics, optional artwork, and numeric ordering', () => {
  const channels = parseSocials(csv)
  assert.equal(channels[0].id, 'github')
  assert.equal(channels[0].confidantImage, '')
  assert.equal(channels[1].description, 'Projects, ideas')
  assert.deepEqual(channels[1].topics, ['Projects', 'Ideas'])
  assert.equal(channels[1].icon, 'p5_gmail_icon.png')
})

test('copy returns an email address for mailto and the full URL for a profile', () => {
  assert.equal(socialCopyValue('mailto:test@example.com'), 'test@example.com')
  assert.equal(socialCopyValue('https://github.com/example'), 'https://github.com/example')
})

test('links permit HTTPS and plain email only, preventing unsafe or unintended actions', () => {
  assert.equal(validateSocialUrl('https://www.linkedin.com/in/example/'), 'https://www.linkedin.com/in/example/')
  assert.equal(validateSocialUrl('mailto:test@example.com'), 'mailto:test@example.com')
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com', 'http://example.com', 'mailto:invalid', 'mailto:test@example.com?body=test', '', '/relative']) {
    assert.throws(() => validateSocialUrl(value))
  }
})

test('empty content, missing icons, duplicate IDs, and invalid orders fail validation', () => {
  for (const value of [header, 'id,order,label\na,1,A', csv.replace('mail,2', 'mail,no'), csv.replace('mail,2', 'github,2'), csv.replace('p5_gmail_icon.png', '')]) {
    assert.throws(() => parseSocials(value))
  }
})


test('confidant images choose unique matches, reserving named rows before blank rows', () => {
  const channels = parseSocials(csv)
  const assigned = assignSocialImages(channels, ['morgana_confidant.jpeg', 'makoto_confidant.jpeg'], () => 0)
  assert.equal(assigned[0].confidantImage, 'makoto_confidant.jpeg')
  assert.equal(assigned[1].confidantImage, 'morgana_confidant.jpeg')
  assert.equal(channels[0].confidantImage, '')
})

test('fresh Socials visits can reroll, while missing/exhausted image pools omit portraits', () => {
  const channels = parseSocials(csv).map(channel => ({ ...channel, confidantImage: '' }))
  const files = ['ann.jpeg', 'makoto.jpeg', 'morgana.jpeg']
  const first = assignSocialImages(channels, files, () => 0)
  const next = assignSocialImages(channels, files, () => .999)
  assert.notDeepEqual(first.map(channel => channel.confidantImage), next.map(channel => channel.confidantImage))
  assert.equal(new Set(first.map(channel => channel.confidantImage)).size, channels.length)
  assert.deepEqual(assignSocialImages(channels, []).map(channel => channel.confidantImage), ['', ''])
})
