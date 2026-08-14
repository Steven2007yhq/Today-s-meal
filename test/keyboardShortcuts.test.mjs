import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveKeyboardShortcut } from '../src/services/keyboardShortcuts.js'

function shortcut(key, overrides = {}) {
  return resolveKeyboardShortcut({ key, defaultPrevented: false, repeat: false, ...overrides })
}

test('page and module shortcuts resolve to explicit destinations', () => {
  assert.deepEqual(shortcut('3', { ctrlKey: true }), { type: 'page', target: 'library' })
  assert.deepEqual(shortcut('4', { altKey: true }), { type: 'module', target: 'fitness' })
})

test('productivity shortcuts resolve without matching plain typing', () => {
  assert.deepEqual(shortcut('k', { ctrlKey: true }), { type: 'search' })
  assert.deepEqual(shortcut('a', { ctrlKey: true, shiftKey: true }), { type: 'assistant' })
  assert.deepEqual(shortcut('/', { ctrlKey: true }), { type: 'document', target: 'keyboard-shortcuts' })
  assert.equal(shortcut('k'), null)
})

test('history, help, and close shortcuts are recognized', () => {
  assert.deepEqual(shortcut('ArrowLeft', { altKey: true }), { type: 'history', direction: 'back' })
  assert.deepEqual(shortcut('F1'), { type: 'document', target: 'user-guide' })
  assert.deepEqual(shortcut('Escape'), { type: 'close-overlay' })
})

test('consumed and repeated key events are ignored', () => {
  assert.equal(shortcut('k', { ctrlKey: true, defaultPrevented: true }), null)
  assert.equal(shortcut('k', { ctrlKey: true, repeat: true }), null)
})
