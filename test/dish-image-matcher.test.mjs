import assert from 'node:assert/strict'
import test from 'node:test'
import { createDishImageMatcher, findSimilarDishImage } from '../shared/dish-image-matcher.mjs'

const candidates = [
  { id: 'dumpling', name: '韭菜猪肉饺子', dish_type: '主食', method: '煮', ingredients: [{ name: '韭菜' }, { name: '猪肉' }, { name: '饺子皮' }] },
  { id: 'stew', name: '白菜粉条炖肉', dish_type: '主食', method: '炖', ingredients: [{ name: '白菜' }, { name: '粉条' }, { name: '猪肉' }] },
  { id: 'chicken', name: '小鸡炖蘑菇', dish_type: '热菜', method: '炖', ingredients: [{ name: '鸡肉' }, { name: '蘑菇' }] },
  { id: 'fish', name: '清蒸鲈鱼', dish_type: '水产', method: '蒸', ingredients: [{ name: '鲈鱼' }] },
  { id: 'drink', name: '鲜榨苹果汁', dish_type: '饮品', method: '调制', ingredients: [{ name: '苹果' }, { name: '水' }] },
  { id: 'pie', name: '苹果派', dish_type: '甜品', method: '烘烤', ingredients: [{ name: '苹果' }, { name: '面粉' }] },
]

test('image matcher gives dish form priority for dumpling variants', () => {
  const match = findSimilarDishImage({
    name: '白菜猪肉饺子', dish_type: '主食', method: '煮', ingredients: [{ name: '白菜' }, { name: '猪肉' }, { name: '饺子皮' }],
  }, candidates)
  assert.equal(match?.candidate.id, 'dumpling')
  assert.match(match?.reason, /饺子/)
})

test('image matcher keeps the main protein visually consistent', () => {
  const match = findSimilarDishImage({
    name: '土豆烧鸡块', dish_type: '热菜', method: '烧', ingredients: [{ name: '土豆' }, { name: '鸡块' }],
  }, candidates)
  assert.equal(match?.candidate.id, 'chicken')
})

test('image matcher does not use an unrelated savory image for a drink', () => {
  const match = findSimilarDishImage({
    name: '哈密瓜果茶', dish_type: '饮品', method: '冲泡', ingredients: [{ name: '哈密瓜' }, { name: '水' }],
  }, candidates)
  assert.equal(match?.candidate.id, 'drink')
})

test('image matcher can leave a dish without a misleading fallback', () => {
  const match = findSimilarDishImage({
    name: '哈密瓜果茶', dish_type: '饮品', method: '冲泡', ingredients: [{ name: '哈密瓜' }],
  }, candidates.filter((candidate) => candidate.id === 'fish'))
  assert.equal(match, null)
})

test('image matcher ignores garnishes when matching seafood', () => {
  const match = findSimilarDishImage({
    name: '干煎红虾', dish_type: '水产', method: '煎', ingredients: [{ name: '红虾' }, { name: '香菜' }, { name: '芝麻油' }],
  }, [
    { id: 'shrimp', name: '香煎大虾', dish_type: '热菜', method: '煎', ingredients: [{ name: '大虾' }] },
    { id: 'coriander', name: '凉拌木耳', dish_type: '凉菜', method: '拌', ingredients: [{ name: '木耳' }, { name: '香菜' }] },
  ])
  assert.equal(match?.candidate.id, 'shrimp')
})

test('image matcher rejects a conflicting main protein even when dish form matches', () => {
  const match = findSimilarDishImage({
    name: '白菜猪肉饺子', dish_type: '主食', method: '煮', ingredients: [{ name: '白菜' }, { name: '猪肉' }],
  }, [
    { id: 'beef-dumpling', name: '白菜牛肉饺子', dish_type: '主食', method: '煮', ingredients: [{ name: '白菜' }, { name: '牛肉' }] },
  ])
  assert.equal(match, null)
})

test('image matcher rejects incompatible food forms despite a shared ingredient', () => {
  const match = findSimilarDishImage({
    name: '苹果派', dish_type: '甜品', method: '烘烤', ingredients: [{ name: '苹果' }, { name: '面粉' }],
  }, [
    { id: 'apple-juice', name: '鲜榨苹果汁', dish_type: '饮品', method: '调制', ingredients: [{ name: '苹果' }, { name: '水' }] },
  ])
  assert.equal(match, null)
})

test('image matcher rejects a fish image that only happens to contain the same pork garnish', () => {
  const match = findSimilarDishImage({
    name: '排骨炖油豆角', dish_type: '热菜', method: '炖', ingredients: [{ name: '排骨' }, { name: '油豆角' }],
  }, [
    { id: 'fish-with-pork', name: '臭鳜鱼', dish_type: '水产', method: '烧', ingredients: [{ name: '鳜鱼' }, { name: '五花肉' }] },
  ])
  assert.equal(match, null)
})

test('image matcher keeps shaped staples separate from an ordinary meat dish', () => {
  const match = findSimilarDishImage({
    name: '杀猪菜', dish_type: '热菜', method: '炖', ingredients: [{ name: '猪肉' }, { name: '酸菜' }],
  }, [
    { id: 'pork-zongzi', name: '蛋黄肉粽', dish_type: '主食', method: '蒸', ingredients: [{ name: '猪肉' }, { name: '糯米' }] },
  ])
  assert.equal(match, null)
})

test('image matcher rejects a visually different cooking method', () => {
  const match = findSimilarDishImage({
    name: '家常烧鱼', dish_type: '水产', method: '烧', ingredients: [{ name: '鲈鱼' }],
  }, [
    { id: 'fried-fish', name: '炸鱼薯条', dish_type: '水产', method: '炸', ingredients: [{ name: '鳕鱼' }] },
  ])
  assert.equal(match, null)
})

test('image matcher does not treat roast meat as a stewed dish', () => {
  const match = findSimilarDishImage({
    name: '杀猪菜', dish_type: '热菜', method: '炖', ingredients: [{ name: '猪肉' }, { name: '酸菜' }],
  }, [
    { id: 'char-siu', name: '蜜汁叉烧', dish_type: '热菜', method: '烧烤', ingredients: [{ name: '猪里脊' }, { name: '蜂蜜' }] },
  ])
  assert.equal(match, null)
})

test('image matcher does not match unrelated dishes from a broad soup category', () => {
  const match = findSimilarDishImage({
    name: '蛋花汤', dish_type: '汤羹', method: '煮', ingredients: [{ name: '鸡蛋' }, { name: '水' }],
  }, [
    { id: 'pumpkin-soup', name: '奶油南瓜汤', dish_type: '汤羹', method: '煮', ingredients: [{ name: '南瓜' }, { name: '奶油' }] },
  ])
  assert.equal(match, null)
})

test('image matcher requires every specialized form to agree', () => {
  const match = findSimilarDishImage({
    name: '清汤刀削面', dish_type: '主食', method: '煮', ingredients: [{ name: '面条' }, { name: '高汤' }],
  }, [
    { id: 'plain-soup', name: '蔬菜汤', dish_type: '汤羹', method: '煮', ingredients: [{ name: '青菜' }, { name: '高汤' }] },
  ])
  assert.equal(match, null)
})

test('image matcher keeps shrimp dumplings separate from a plain shrimp stir-fry', () => {
  const match = findSimilarDishImage({
    name: '生炒虾饺', dish_type: '主食', method: '炒', ingredients: [{ name: '虾仁' }, { name: '饺子皮' }],
  }, [
    { id: 'shrimp-stir-fry', name: '龙井虾仁', dish_type: '水产', method: '炒', ingredients: [{ name: '虾仁' }, { name: '茶叶' }] },
  ])
  assert.equal(match, null)
})

test('image matcher keeps wontons separate from dumplings', () => {
  const match = findSimilarDishImage({
    name: '紫菜馄饨汤', dish_type: '汤羹', method: '煮', ingredients: [{ name: '猪肉' }, { name: '紫菜' }],
  }, [
    { id: 'pork-dumpling', name: '猪肉饺子', dish_type: '主食', method: '煮', ingredients: [{ name: '猪肉' }, { name: '饺子皮' }] },
  ])
  assert.equal(match, null)
})

test('image matcher accepts a category reference profile with string ingredients', () => {
  const match = findSimilarDishImage({
    name: '大米鸡肉粥', dish_type: '粥品', method: '熬粥', ingredients: [{ name: '鸡肉' }, { name: '大米' }],
  }, [
    { dish_id: 'category-ref-1', name: '鸡丝粥', dish_type: '粥品', method: '熬粥', ingredients: ['鸡肉', '大米'] },
  ])
  assert.equal(match?.candidate.dish_id, 'category-ref-1')
})

test('image matcher keeps specialized rice presentations separate', () => {
  const match = findSimilarDishImage({
    name: '牛肉烩饭', dish_type: '主食', method: '烩', ingredients: [{ name: '牛肉' }, { name: '米饭' }],
  }, [
    { id: 'claypot-rice', name: '牛肉煲仔饭', dish_type: '主食', method: '煲', ingredients: [{ name: '牛肉' }, { name: '米饭' }] },
  ])
  assert.equal(match, null)
})

test('image matcher does not use a steamed patty for a whole pork cut', () => {
  const match = findSimilarDishImage({
    name: '清蒸猪里脊', dish_type: '蒸菜', method: '蒸', ingredients: [{ name: '猪里脊' }],
  }, [
    { id: 'pork-patty', name: '香菇蒸肉饼', dish_type: '蒸菜', method: '蒸', ingredients: [{ name: '猪肉' }, { name: '香菇' }] },
  ])
  assert.equal(match, null)
})

test('image matcher does not treat vegetarian chicken as actual chicken', () => {
  const match = findSimilarDishImage({
    name: '清蒸鸡块', dish_type: '蒸菜', method: '蒸', ingredients: [{ name: '鸡肉' }],
  }, [
    { id: 'vegetarian-chicken', name: '清蒸素鸡', dish_type: '蒸菜', method: '蒸', ingredients: ['素鸡', '香菇'] },
  ])
  assert.equal(match, null)
})

test('image matcher keeps distinct noodle shapes separate', () => {
  const match = findSimilarDishImage({
    name: '牛肉刀削面', dish_type: '主食', method: '煮', ingredients: [{ name: '牛肉' }, { name: '刀削面' }],
  }, [
    { id: 'beef-rice-noodles', name: '牛肉米线', dish_type: '主食', method: '煮', ingredients: ['牛肉', '米线'] },
  ])
  assert.equal(match, null)
})

test('image matcher does not use plain greens for a spicy hot pot', () => {
  const match = findSimilarDishImage({
    name: '麻辣香锅', dish_type: '热菜', method: '炒', ingredients: [{ name: '青菜' }, { name: '豆腐' }],
  }, [
    { id: 'garlic-greens', name: '蒜蓉青菜', dish_type: '热菜', method: '炒', ingredients: ['青菜', '大蒜'] },
  ])
  assert.equal(match, null)
})

test('image matcher keeps carrot and white-radish salads separate', () => {
  const match = findSimilarDishImage({
    name: '凉拌白萝卜丝', dish_type: '凉菜', method: '凉拌', ingredients: [{ name: '白萝卜' }],
  }, [
    { id: 'kelp-salad', name: '凉拌海带丝', dish_type: '凉菜', method: '凉拌', ingredients: ['海带', '胡萝卜'] },
  ])
  assert.equal(match, null)
})

test('image matcher does not use a wholegrain bun for an ordinary white bun', () => {
  const match = findSimilarDishImage({
    name: '香菇素菜包子', dish_type: '主食', method: '蒸', ingredients: [{ name: '香菇' }, { name: '白菜' }],
  }, [
    { id: 'wholegrain-bun', name: '全麦素菜包子', dish_type: '主食', method: '蒸', ingredients: ['全麦面粉', '豆腐'] },
  ])
  assert.equal(match, null)
})

test('compiled image matcher can reuse candidate features for a request batch', () => {
  const findMatch = createDishImageMatcher(candidates)
  assert.equal(findMatch({
    name: '白菜猪肉水饺', dish_type: '主食', method: '煮', ingredients: [{ name: '白菜' }, { name: '猪肉' }],
  })?.candidate.id, 'dumpling')
  assert.equal(findMatch({
    name: '清蒸鳕鱼', dish_type: '水产', method: '蒸', ingredients: [{ name: '鳕鱼' }],
  })?.candidate.id, 'fish')
})
