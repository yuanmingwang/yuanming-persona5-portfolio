import test from 'node:test'
import assert from 'node:assert/strict'
import { ignoreMenuKey, menuNavigationIndex } from '../src/lib/menuKeyboard.ts'

test('Up/Down move one entry and wrap at either end', () => {
  assert.equal(menuNavigationIndex('ArrowDown', 0, 4), 1)
  assert.equal(menuNavigationIndex('ArrowUp', 2, 4), 1)
  assert.equal(menuNavigationIndex('ArrowUp', 0, 4), 3)
  assert.equal(menuNavigationIndex('ArrowDown', 3, 4), 0)
})

test('Home/End, empty search results, and one-item lists are handled', () => {
  assert.equal(menuNavigationIndex('Home', 2, 4), 0)
  assert.equal(menuNavigationIndex('End', 1, 4), 3)
  assert.equal(menuNavigationIndex('ArrowDown', 0, 0), undefined)
  assert.equal(menuNavigationIndex('ArrowUp', 0, 1), 0)
  assert.equal(menuNavigationIndex('ArrowDown', 0, 1), 0)
  assert.equal(menuNavigationIndex('Escape', 0, 4), undefined)
})

test('editable fields, native shortcuts, composition, and handled keys are left alone', () => {
  assert.equal(ignoreMenuKey({}, false), false)
  assert.equal(ignoreMenuKey({}, true), true)
  for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
    assert.equal(ignoreMenuKey({ [flag]: true }, false), true)
  }
})
