import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCatalogListInput } from '../server/catalog-service.mjs'

test('catalog list input is bounded for a 5000-dish paginated catalog', () => {
  assert.deepEqual(normalizeCatalogListInput({ q: '  番茄炒蛋  ', page: '2', limit: '500' }), {
    query: '番茄炒蛋', cuisine: '', region: '', dishType: '', page: 2, limit: 60,
  })
  assert.equal(normalizeCatalogListInput({ page: '-1', limit: '0' }).page, 1)
  assert.equal(normalizeCatalogListInput({ page: '-1', limit: '0' }).limit, 36)
})
