import assert from 'node:assert/strict'
import test from 'node:test'
import { scalePortionFromIngredient, scalePortionFromIngredients } from '../src/services/ingredientScaling.js'

const portion = {
  multiplier: 1,
  ingredients: [
    { name: '鸡肉', grams: 200 },
    { name: '土豆', grams: 150 },
    { name: '食用油', grams: 10 },
  ],
  nutrition: { calories: 500, protein: 40, fat: 20 },
  reason: '原始建议',
}

test('ingredient scaling uses one ingredient as the proportional anchor', () => {
  const result = scalePortionFromIngredient(portion, 0, 300)
  assert.deepEqual(result.ingredients.map((item) => item.grams), [300, 225, 15])
  assert.deepEqual(result.nutrition, { calories: 750, protein: 60, fat: 30 })
  assert.equal(result.multiplier, 1.5)
  assert.equal(result.adjustment.ingredientName, '鸡肉')
  assert.equal(result.adjustment.baseMultiplier, 1)
  assert.match(result.reason, /其他食材和营养/)
})

test('ingredient scaling preserves an exact user target and kitchen-rounds other items', () => {
  const result = scalePortionFromIngredient(portion, 1, 123)
  assert.equal(result.ingredients[1].grams, 123)
  assert.equal(result.ingredients[0].grams, 165)
  assert.equal(result.ingredients[2].grams, 8)
})

test('ingredient scaling constrains extreme quantities to a safe working range', () => {
  const result = scalePortionFromIngredient(portion, 2, 1000)
  assert.equal(result.adjustment.constrained, true)
  assert.equal(result.adjustment.targetGrams, 100)
  assert.equal(result.adjustment.maximumGrams, 100)
})

test('ingredient scaling leaves the recommendation unchanged for invalid input', () => {
  assert.equal(scalePortionFromIngredient(portion, 9, 200), portion)
  assert.equal(scalePortionFromIngredient(portion, 0, 0), portion)
  assert.equal(scalePortionFromIngredient(portion, 0, 'not-a-number'), portion)
})

test('multiple consistent anchors recover one exact recipe scale', () => {
  const result = scalePortionFromIngredients(portion, [
    { ingredientIndex: 0, grams: 300 },
    { ingredientIndex: 1, grams: 225 },
  ])
  assert.deepEqual(result.ingredients.map((item) => item.grams), [300, 225, 15])
  assert.equal(result.adjustment.mode, 'regression')
  assert.equal(result.adjustment.anchorCount, 2)
  assert.equal(result.adjustment.scale, 1.5)
  assert.equal(result.adjustment.meanErrorPercent, 0)
  assert.equal(result.adjustment.fitQuality, '高')
})

test('multiple inconsistent anchors preserve user inputs and fit the remaining ingredients', () => {
  const result = scalePortionFromIngredients(portion, [
    { ingredientIndex: 0, grams: 300 },
    { ingredientIndex: 1, grams: 180 },
  ])
  assert.deepEqual(result.ingredients.map((item) => item.grams), [300, 180, 14])
  assert.equal(result.adjustment.scale, 1.35)
  assert.equal(result.adjustment.meanErrorPercent, 11.1)
  assert.equal(result.adjustment.fitQuality, '中')
  assert.equal(result.nutrition.calories, 675)
})

test('multiple anchors ignore invalid and duplicate entries deterministically', () => {
  const result = scalePortionFromIngredients(portion, [
    { ingredientIndex: 0, grams: 250 },
    { ingredientIndex: 0, grams: 300 },
    { ingredientIndex: 8, grams: 200 },
    { ingredientIndex: 1, grams: 0 },
  ])
  assert.equal(result.adjustment.anchorCount, 1)
  assert.equal(result.ingredients[0].grams, 300)
  assert.equal(result.adjustment.scale, 1.5)
})
