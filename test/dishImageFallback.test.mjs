import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalDishImageResolver } from '../src/services/dishImageFallback.js'

const resolveLocalDishImage = createLocalDishImageResolver([
  { id: 'fish', name: '清蒸鲈鱼', dishType: '水产', method: '清蒸', ingredients: [{ name: '鲈鱼' }], image: '/fish.jpg' },
  { id: 'chicken', name: '小鸡炖蘑菇', dishType: '热菜', method: '炖', ingredients: [{ name: '鸡肉' }, { name: '蘑菇' }], image: '/chicken.jpg' },
  { id: 'pie', name: '苹果派', dishType: '甜品', method: '烘烤', ingredients: [{ name: '苹果' }, { name: '面粉' }], image: '/pie.jpg' },
])

test('local image resolver reuses a homogeneous image with disclosure metadata', () => {
  const image = resolveLocalDishImage({
    id: 'cod', name: '清蒸鳕鱼', dishType: '水产', method: '蒸', ingredients: [{ name: '鳕鱼' }],
  })
  assert.equal(image?.url, '/fish.jpg')
  assert.equal(image?.reused, true)
  assert.equal(image?.source, 'local')
  assert.equal(image?.sourceDishName, '清蒸鲈鱼')
})

test('local image resolver leaves a dish with its own image untouched', () => {
  const image = resolveLocalDishImage({
    id: 'own', name: '宫保鸡丁', dishType: '热菜', method: '炒', ingredients: [{ name: '鸡肉' }], image: '/own.jpg',
  })
  assert.equal(image, null)
})

test('local image resolver refuses a conflicting animal image', () => {
  const image = resolveLocalDishImage({
    id: 'beef', name: '番茄炖牛肉', dishType: '热菜', method: '炖', ingredients: [{ name: '牛肉' }, { name: '番茄' }],
  })
  assert.equal(image, null)
})

test('local image resolver does not confuse a drink with an apple pie', () => {
  const image = resolveLocalDishImage({
    id: 'juice', name: '鲜榨苹果汁', dishType: '饮品', method: '调制', ingredients: [{ name: '苹果' }, { name: '水' }],
  })
  assert.equal(image, null)
})
