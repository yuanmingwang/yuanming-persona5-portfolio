import test from 'node:test'
import assert from 'node:assert/strict'
import { getStingerCue, initialNavigation, navigationReducer } from '../src/lib/navigation.ts'

const openAbout = { type: 'navigate', target: 'about', label: 'ABOUT ME', reducedMotion: false }

test('switches the page only after cover, then removes the overlay', () => {
  const covering = navigationReducer(initialNavigation, openAbout)
  assert.equal(covering.page, null)
  assert.equal(covering.transition.phase, 'cover')
  const revealing = navigationReducer(covering, { type: 'covered' })
  assert.equal(revealing.page, 'about')
  assert.equal(revealing.transition.phase, 'reveal')
  const finished = navigationReducer(revealing, { type: 'finished' })
  assert.deepEqual(finished, { page: 'about', transition: null })
})

test('ignores repeated navigation and out-of-order animation callbacks', () => {
  const covering = navigationReducer(initialNavigation, openAbout)
  assert.equal(navigationReducer(covering, { ...openAbout, target: 'resume' }), covering)
  assert.equal(navigationReducer(covering, { type: 'finished' }), covering)
  const revealing = navigationReducer(covering, { type: 'covered' })
  assert.equal(navigationReducer(revealing, { type: 'covered' }), revealing)
  assert.equal(navigationReducer(revealing, openAbout), revealing)
})

test('returning to the menu follows the same cover and reveal sequence', () => {
  const covering = navigationReducer({ page: 'about', transition: null }, {
    type: 'navigate', target: null, label: 'MAIN MENU', reducedMotion: false,
  })
  assert.equal(covering.page, 'about')
  assert.equal(covering.transition.label, 'MAIN MENU')
  const revealing = navigationReducer(covering, { type: 'covered' })
  assert.equal(revealing.page, null)
  assert.deepEqual(navigationReducer(revealing, { type: 'finished' }), initialNavigation)
})

test('reduced motion changes pages immediately; same-page navigation is a no-op', () => {
  assert.deepEqual(navigationReducer(initialNavigation, { ...openAbout, reducedMotion: true }), {
    page: 'about', transition: null,
  })
  assert.equal(navigationReducer(initialNavigation, { ...openAbout, target: null }), initialNavigation)
})


test('video timing waits for opaque coverage and avoids a late visible page swap', () => {
  assert.equal(getStingerCue(0), 'wait')
  assert.equal(getStingerCue(1.49), 'wait')
  assert.equal(getStingerCue(1.5), 'covered')
  assert.equal(getStingerCue(2.1), 'covered')
  assert.equal(getStingerCue(2.2), 'fallback')
  assert.equal(getStingerCue(3.4), 'fallback')
})
