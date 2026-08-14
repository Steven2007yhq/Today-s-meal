import assert from 'node:assert/strict'
import test from 'node:test'
import {
  readJsonStorage,
  readStorageValue,
  removeStorageValue,
  writeJsonStorage,
  writeStorageValue,
} from '../src/services/browserStorage.js'

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('JSON storage validates persisted shapes and falls back safely', () => {
  const storage = createStorage({ valid: '[1,2]', invalid: '{', wrongShape: '{}' })
  assert.deepEqual(readJsonStorage('valid', [], Array.isArray, storage), [1, 2])
  assert.deepEqual(readJsonStorage('invalid', ['fallback'], Array.isArray, storage), ['fallback'])
  assert.deepEqual(readJsonStorage('wrongShape', ['fallback'], Array.isArray, storage), ['fallback'])
})

test('storage writes and removals report success without leaking browser errors', () => {
  const storage = createStorage()
  assert.equal(writeStorageValue('plain', 'value', storage), true)
  assert.equal(readStorageValue('plain', '', storage), 'value')
  assert.equal(writeJsonStorage('json', { ok: true }, storage), true)
  assert.deepEqual(readJsonStorage('json', null, () => true, storage), { ok: true })
  assert.equal(removeStorageValue('plain', storage), true)
  assert.equal(readStorageValue('plain', 'missing', storage), 'missing')
})

test('unavailable or quota-limited storage never crashes the caller', () => {
  const failingStorage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('quota') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(readStorageValue('key', 'fallback', failingStorage), 'fallback')
  assert.equal(writeStorageValue('key', 'value', failingStorage), false)
  assert.equal(writeJsonStorage('key', { value: true }, failingStorage), false)
  assert.equal(removeStorageValue('key', failingStorage), false)
})
