import assert from 'node:assert/strict'
import test from 'node:test'
import { buildExpandedCatalog, buildTopRelations, catalogQualityReport } from '../scripts/catalog_seed_lib.mjs'
import { catalogDishIssues, catalogIngredientAudit, normalizeImportedDish } from '../scripts/catalog_quality_rules.mjs'

test('expanded catalog reaches 5000 unique, labeled dishes', () => {
  const dishes = buildExpandedCatalog({
    coreDishes: [{ id: 'core-1', name: '青菜炒豆腐', cuisine: '家常菜', method: '炒', taste: ['咸鲜'], ingredients: [{ name: '青菜', grams: 200 }], nutrition: { calories: 60 }, tags: [] }],
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

test('catalog quality rules reject unsafe titles and alcoholic drinks', () => {
  assert.ok(catalogDishIssues({ name: 'B52轰炸机', dishType: '饮品', ingredients: [{ name: '伏特加' }] }).length >= 2)
  assert.ok(catalogDishIssues({ name: '长岛冰茶', dishType: '饮品', ingredients: [{ name: '金酒' }] }).length >= 1)
  assert.equal(catalogDishIssues({ name: '啤酒鸭', dishType: '热菜', ingredients: [{ name: '啤酒' }] }).length, 0)
})

test('catalog quality rules replace sensational imported dish names', () => {
  assert.equal(normalizeImportedDish({ name: '韩国麻药鸡蛋' }).name, '韩式酱汁溏心蛋')
  assert.equal(normalizeImportedDish({ name: '尖叫牛蛙' }).name, '泡椒牛蛙')
})

test('catalog quality report exposes suspicious names to the seed gate', () => {
  const report = catalogQualityReport([
    { id: 'safe', name: '清炒小白菜', ingredients: [{ name: '小白菜' }] },
    { id: 'unsafe', name: '示例菜', ingredients: [{ name: '白菜' }] },
  ])
  assert.deepEqual(report.suspiciousNames, [{ name: '示例菜', issues: ['菜品名包含不适合面向家庭用户展示的词语'] }])
})

test('catalog ingredient audit catches tools parsed as food', () => {
  assert.deepEqual(catalogIngredientAudit([
    { name: '蒸蛋', ingredients: [{ name: '鸡蛋' }, { name: '厨房用温度计' }] },
  ]), [{ dish: '蒸蛋', ingredient: '厨房用温度计', issue: '厨具或耗材被误识别为食材' }])
})
