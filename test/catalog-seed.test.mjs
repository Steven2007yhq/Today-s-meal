import assert from 'node:assert/strict'
import test from 'node:test'
import { buildExpandedCatalog, buildTopRelations, catalogQualityReport } from '../scripts/catalog_seed_lib.mjs'

test('expanded catalog reaches 5000 unique, labeled dishes', () => {
  const dishes = buildExpandedCatalog({
    coreDishes: [{ id: 'core-1', name: '测试家常菜', cuisine: '家常菜', method: '炒', taste: ['咸鲜'], ingredients: [{ name: '青菜', grams: 200 }], nutrition: { calories: 60 }, tags: [] }],
    openRecipes: [{ id: 'open-1', name: '来源候选菜', cuisine: '开源家常菜', method: '煮', taste: ['清鲜'], ingredients: [{ name: '白菜', grams: 200 }], nutrition: {}, tags: [], source: 'howtocook' }],
    targetSize: 5_000,
  })
  assert.equal(dishes.length, 5_000)
  assert.equal(new Set(dishes.map((dish) => dish.name.normalize('NFKC'))).size, 5_000)
  const generated = dishes.find((dish) => dish.reviewStatus === 'generated')
  assert.equal(generated.nutritionConfidence, 'estimated')
  assert.ok(generated.tags.includes('家常搭配'))
  assert.equal(dishes.find((dish) => dish.id === 'open-1').reviewStatus, 'candidate')
})

test('top-k dish graph stays bounded instead of becoming a complete graph', () => {
  const dishes = buildExpandedCatalog({ targetSize: 600 })
  const relations = buildTopRelations(dishes, 12)
  const report = catalogQualityReport(dishes, relations)
  assert.equal(report.total, 600)
  assert.equal(report.duplicateNames.length, 0)
  assert.ok(report.relations <= 600 * 12)
  assert.ok(report.maxRelationsPerDish <= 12)
})
