import assert from 'node:assert/strict'
import test from 'node:test'
import { createDishImageCandidateCache } from '../server/dish-image-candidate-cache.mjs'

test('image candidate cache reuses a fresh catalog and refreshes after expiry', async () => {
  let clock = 1_000
  let loads = 0
  const cache = createDishImageCandidateCache({
    now: () => clock,
    ttlMs: 100,
    loadCandidates: async () => [{ id: `image-${++loads}` }],
  })

  assert.deepEqual(await cache.read(), [{ id: 'image-1' }])
  assert.deepEqual(await cache.read(), [{ id: 'image-1' }])
  assert.equal(loads, 1)

  clock += 101
  assert.deepEqual(await cache.read(), [{ id: 'image-2' }])
  assert.equal(loads, 2)
})

test('image candidate cache coalesces concurrent database loads', async () => {
  let resolveLoad
  let loads = 0
  const cache = createDishImageCandidateCache({
    loadCandidates: () => {
      loads += 1
      return new Promise((resolve) => { resolveLoad = resolve })
    },
  })

  const first = cache.read()
  const second = cache.read()
  await Promise.resolve()
  resolveLoad([{ id: 'shared' }])

  assert.deepEqual(await first, [{ id: 'shared' }])
  assert.deepEqual(await second, [{ id: 'shared' }])
  assert.equal(loads, 1)
})

test('image candidate cache invalidation forces a fresh catalog', async () => {
  let loads = 0
  const cache = createDishImageCandidateCache({
    loadCandidates: async () => [{ version: ++loads }],
  })

  assert.deepEqual(await cache.read(), [{ version: 1 }])
  cache.invalidate()
  assert.deepEqual(await cache.read(), [{ version: 2 }])
})

test('image candidate cache does not restore an in-flight catalog after invalidation', async () => {
  const resolvers = []
  const cache = createDishImageCandidateCache({
    loadCandidates: () => new Promise((resolve) => resolvers.push(resolve)),
  })

  const staleRead = cache.read()
  await Promise.resolve()
  cache.invalidate()
  const freshRead = cache.read()
  await Promise.resolve()

  resolvers[0]([{ version: 'stale' }])
  resolvers[1]([{ version: 'fresh' }])
  assert.deepEqual(await staleRead, [{ version: 'stale' }])
  assert.deepEqual(await freshRead, [{ version: 'fresh' }])
  assert.deepEqual(await cache.read(), [{ version: 'fresh' }])
})

test('image candidate cache can use stale data when a refresh briefly fails', async () => {
  let clock = 1_000
  let shouldFail = false
  const cache = createDishImageCandidateCache({
    now: () => clock,
    ttlMs: 100,
    loadCandidates: async () => {
      if (shouldFail) throw new Error('temporary database failure')
      return [{ id: 'last-known-good' }]
    },
  })

  await cache.read()
  clock += 101
  shouldFail = true
  assert.deepEqual(await cache.read(), [{ id: 'last-known-good' }])
})
