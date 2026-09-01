import crypto from 'node:crypto'
import { catalogIngredientAudit, catalogQualityAudit } from './catalog_quality_rules.mjs'

const pantryIngredients = new Set(['食用油', '生姜', '姜', '小葱', '葱', '食盐', '盐', '酱油', '生抽', '老抽', '白糖', '糖', '淀粉', '大蒜', '蒜'])

const vegetables = [
  '青椒', '彩椒', '西兰花', '花菜', '芹菜', '菠菜', '油菜', '小白菜', '大白菜', '娃娃菜', '生菜', '空心菜',
  '茼蒿', '韭菜', '蒜苗', '荷兰豆', '四季豆', '豆角', '豌豆', '毛豆', '黄瓜', '西葫芦', '丝瓜', '苦瓜',
  '冬瓜', '南瓜', '茄子', '土豆', '山药', '莲藕', '莴笋', '竹笋', '胡萝卜', '白萝卜', '西红柿', '洋葱',
  '香菇', '平菇', '杏鲍菇', '木耳', '银耳', '豆芽', '茭白', '荸荠', '西芹',
]
const sauteProteins = ['猪肉片', '猪里脊', '牛肉', '羊肉', '鸡胸肉', '鸡丁', '虾仁', '鱿鱼', '鸡蛋', '豆腐', '香干', '腐竹', '肉末']
const braiseProteins = ['排骨', '五花肉', '猪蹄', '猪里脊', '牛肉', '牛腩', '羊肉', '鸡块', '鸡翅', '鸭肉', '草鱼', '鲈鱼', '鱼片', '虾仁', '鱿鱼', '豆腐', '油豆腐', '腐竹']
const stewProteins = ['排骨', '五花肉', '猪蹄', '牛肉', '牛腩', '羊肉', '鸡块', '鸡腿', '鸭肉', '草鱼', '鲫鱼', '鱼头', '豆腐', '腐竹', '肉丸']
const braiseVegetables = ['土豆', '山药', '莲藕', '白萝卜', '胡萝卜', '冬瓜', '南瓜', '茄子', '豆角', '四季豆', '大白菜', '娃娃菜', '竹笋', '莴笋', '香菇', '平菇', '杏鲍菇', '木耳', '海带', '豆腐', '油豆腐', '腐竹', '粉条', '芋头', '板栗']
const stewVegetables = ['土豆', '山药', '莲藕', '白萝卜', '胡萝卜', '冬瓜', '南瓜', '大白菜', '娃娃菜', '竹笋', '香菇', '平菇', '海带', '豆腐', '腐竹', '粉条', '芋头', '玉米']
const soupVegetables = ['西红柿', '冬瓜', '丝瓜', '苦瓜', '白萝卜', '胡萝卜', '山药', '莲藕', '玉米', '大白菜', '娃娃菜', '菠菜', '小白菜', '香菇', '平菇', '金针菇', '木耳', '海带', '紫菜', '豆腐', '粉丝', '莴笋', '竹笋', '芋头', '南瓜']
const soupProteins = ['排骨', '猪肉片', '肉丸', '牛肉', '牛腩', '羊肉', '鸡块', '鸡蛋', '鲫鱼', '鱼片', '鱼头', '虾仁', '蛤蜊', '豆腐', '腐竹']
const coldVegetables = ['黄瓜', '木耳', '海带丝', '豆腐皮', '腐竹', '莴笋', '莲藕', '菠菜', '西芹', '豆芽', '苦瓜', '西红柿', '茄子', '土豆丝', '萝卜丝', '白菜心', '金针菇', '银耳', '粉丝', '皮蛋豆腐', '秋葵', '豇豆', '西兰花', '花生米', '毛豆', '笋丝', '海蜇', '鸡丝', '牛肉', '猪耳']
const toppingBases = ['牛肉', '牛腩', '羊肉', '鸡丁', '鸡腿', '排骨', '肉末', '叉烧', '卤肉', '鱼片', '虾仁', '鸡蛋', '豆腐', '香菇', '西红柿鸡蛋', '青椒肉丝', '土豆牛肉', '咖喱鸡肉', '酸菜肉丝', '雪菜肉丝', '炸酱', '红烧肉', '三鲜', '素什锦', '菌菇']
const grains = ['大米', '小米', '糙米', '黑米', '燕麦', '玉米', '薏米', '红豆', '绿豆', '藜麦', '荞麦', '紫米', '糯米', '高粱米', '山药']
const congeeAdditions = ['南瓜', '红薯', '山药', '莲子', '百合', '红枣', '桂圆', '花生', '核桃', '芝麻', '玉米', '胡萝卜', '香菇', '青菜', '皮蛋', '瘦肉', '鸡肉', '鱼片', '虾仁', '牛肉']
const fillingProteins = ['猪肉', '牛肉', '羊肉', '鸡肉', '虾仁', '鱼肉', '鸡蛋', '豆腐', '香干', '粉丝', '菌菇', '素什锦']
const fillingVegetables = ['白菜', '韭菜', '芹菜', '茴香', '萝卜', '胡萝卜', '香菇', '木耳', '玉米', '青椒', '豆角', '莲藕', '西葫芦', '荠菜', '酸菜', '大葱', '洋葱', '茄子', '南瓜', '莴笋']
const fruits = ['苹果', '梨', '香蕉', '芒果', '草莓', '蓝莓', '桃', '橙子', '柚子', '菠萝', '猕猴桃', '火龙果', '荔枝', '龙眼', '葡萄', '西瓜', '哈密瓜', '木瓜', '山楂', '柿子']

const cuisineRegions = {
  鲁菜: ['山东'], 川菜: ['四川', '重庆'], 粤菜: ['广东'], 苏菜: ['江苏'], 闽菜: ['福建'], 浙菜: ['浙江'],
  湘菜: ['湖南'], 徽菜: ['安徽'], 东北菜: ['辽宁', '吉林', '黑龙江'], 节日美食: ['全国'], 西式料理: ['全国'],
  家常菜: ['全国'], 主食小吃: ['全国'],
}

function stableHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 20)
}

export function normalizeDishName(value) {
  return String(value || '').normalize('NFKC').replace(/[\s·•、，,。()（）\-—_]/g, '').toLowerCase()
}

function nutritionProfile(name) {
  if (/油/.test(name)) return [899, 0, 0, 100, 0, 0]
  if (/五花肉|猪蹄|排骨|猪耳/.test(name)) return [320, 18, 0, 27, 0, 85]
  if (/猪|牛|羊|鸡|鸭|肉|叉烧|卤肉/.test(name)) return [190, 25, 1, 10, 0, 70]
  if (/鱼|虾|蟹|蛤|鱿|海蜇/.test(name)) return [110, 20, 2, 3, 0, 150]
  if (/鸡蛋|蛋/.test(name)) return [145, 13, 2, 10, 0, 140]
  if (/豆腐|豆皮|豆腐皮|香干|腐竹|油豆腐/.test(name)) return [145, 14, 8, 8, 2, 35]
  if (/米|面|粉|饭|粥|饺|包|饼|馍|河粉|年糕/.test(name)) return [230, 6, 48, 2, 2, 20]
  if (/花生|核桃|芝麻/.test(name)) return [560, 20, 20, 46, 9, 10]
  if (/红豆|绿豆|豌豆|毛豆/.test(name)) return [330, 20, 52, 7, 12, 15]
  if (fruits.some((fruit) => name.includes(fruit))) return [52, 1, 13, 0.3, 2, 3]
  if (/盐|酱|醋|味精|鸡精|胡椒|料酒|淀粉|糖/.test(name)) return [80, 1, 18, 0, 0, 600]
  return [34, 2, 7, 0.4, 2.8, 28]
}

function ingredient(name, grams) {
  return { name, grams }
}

function calculateNutrition(ingredients) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
  for (const item of ingredients) {
    const profile = nutritionProfile(item.name)
    const factor = Number(item.grams || 0) / 100
    Object.keys(totals).forEach((key, index) => { totals[key] += profile[index] * factor })
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 10) / 10]))
}

function tasteFor(method, name) {
  if (/酸菜|糖醋|山楂/.test(name)) return ['酸香', '家常鲜香']
  if (/香辣|辣|剁椒/.test(name)) return ['香辣', '咸鲜']
  if (/蜜汁|红枣|桂圆|水果|甜/.test(name)) return ['香甜']
  if (/清蒸|白灼|汤|粥/.test(method + name)) return ['清鲜']
  if (/煎|炸|烤/.test(method + name)) return ['焦香', '咸鲜']
  return ['家常鲜香', '咸鲜']
}

function createCombination({ name, method, ingredients, dishType = '热菜', cuisine = '家常搭配', mealTypes = ['午餐', '晚餐'] }) {
  const withSeasoning = [...ingredients]
  if (/炒|烧|煎|烤|炸|焖/.test(method) && !withSeasoning.some((item) => item.name === '食用油')) withSeasoning.push(ingredient('食用油', /炸/.test(method) ? 20 : 10))
  return {
    id: `combo-${stableHash(normalizeDishName(name))}`,
    name,
    aliases: [],
    cuisine,
    regions: ['全国'],
    dishType,
    mealTypes,
    method,
    taste: tasteFor(method, name),
    ingredients: withSeasoning,
    nutrition: calculateNutrition(withSeasoning),
    tags: [dishType, '家常搭配', '营养为估算'],
    source: 'internal_combination',
    sourceUrl: null,
    licenseType: 'project_owned',
    evidenceLevel: 'C',
    reviewStatus: 'generated',
    nutritionConfidence: 'estimated',
    publicationStatus: 'published',
  }
}

function* combinationCandidates() {
  for (const vegetable of vegetables) for (const protein of sauteProteins) yield createCombination({ name: `${vegetable}炒${protein}`, method: '炒', ingredients: [ingredient(vegetable, 150), ingredient(protein, 160)] })
  for (const protein of braiseProteins) for (const vegetable of braiseVegetables) yield createCombination({ name: `${protein}烧${vegetable}`, method: '烧', ingredients: [ingredient(protein, 180), ingredient(vegetable, 160)] })
  for (const protein of stewProteins) for (const vegetable of stewVegetables) yield createCombination({ name: `${protein}炖${vegetable}`, method: '炖', ingredients: [ingredient(protein, 180), ingredient(vegetable, 180)] })
  for (const vegetable of soupVegetables) for (const protein of soupProteins) yield createCombination({ name: `${vegetable}${protein}汤`, method: '煮汤', ingredients: [ingredient(vegetable, 160), ingredient(protein, 140)], dishType: '汤羹' })
  for (const vegetable of vegetables) {
    yield createCombination({ name: `清炒${vegetable}`, method: '清炒', ingredients: [ingredient(vegetable, 260)] })
    yield createCombination({ name: `蒜蓉${vegetable}`, method: '炒', ingredients: [ingredient(vegetable, 250), ingredient('大蒜', 15)] })
    yield createCombination({ name: `蚝油${vegetable}`, method: '炒', ingredients: [ingredient(vegetable, 250), ingredient('蚝油', 10)] })
    yield createCombination({ name: `上汤${vegetable}`, method: '煮', ingredients: [ingredient(vegetable, 220), ingredient('高汤', 180)] })
  }
  for (const vegetable of coldVegetables) {
    yield createCombination({ name: `凉拌${vegetable}`, method: '凉拌', ingredients: [ingredient(vegetable, 240)], dishType: '凉菜' })
    yield createCombination({ name: `蒜泥拌${vegetable}`, method: '凉拌', ingredients: [ingredient(vegetable, 230), ingredient('大蒜', 15)], dishType: '凉菜' })
    yield createCombination({ name: `麻酱拌${vegetable}`, method: '凉拌', ingredients: [ingredient(vegetable, 230), ingredient('芝麻酱', 20)], dishType: '凉菜' })
  }
  for (const topping of toppingBases) {
    const toppingIngredients = [ingredient(topping, 150)]
    for (const [suffix, method] of [['汤面', '煮'], ['拌面', '拌'], ['炒面', '炒'], ['刀削面', '煮'], ['米线', '煮'], ['河粉', '煮']]) {
      yield createCombination({ name: `${topping}${suffix}`, method, ingredients: [...toppingIngredients, ingredient(suffix, 190)], dishType: '主食', cuisine: '主食小吃', mealTypes: ['早餐', '午餐', '晚餐'] })
    }
    for (const [suffix, method] of [['盖饭', '烩'], ['炒饭', '炒'], ['焖饭', '焖'], ['煲仔饭', '煲'], ['烩饭', '烩']]) {
      yield createCombination({ name: `${topping}${suffix}`, method, ingredients: [...toppingIngredients, ingredient('米饭', 220)], dishType: '主食', cuisine: '主食小吃', mealTypes: ['午餐', '晚餐'] })
    }
  }
  for (const grain of grains) for (const addition of congeeAdditions) yield createCombination({ name: `${grain}${addition}粥`, method: '熬粥', ingredients: [ingredient(grain, 70), ingredient(addition, 80)], dishType: '粥品', cuisine: '主食小吃', mealTypes: ['早餐', '晚餐'] })
  for (const protein of fillingProteins) for (const vegetable of fillingVegetables) {
    yield createCombination({ name: `${vegetable}${protein}饺子`, method: '煮', ingredients: [ingredient(vegetable, 120), ingredient(protein, 120), ingredient('饺子皮', 160)], dishType: '主食', cuisine: '主食小吃', mealTypes: ['早餐', '午餐', '晚餐'] })
    yield createCombination({ name: `${vegetable}${protein}包子`, method: '蒸', ingredients: [ingredient(vegetable, 120), ingredient(protein, 120), ingredient('面粉', 170)], dishType: '主食', cuisine: '主食小吃', mealTypes: ['早餐', '午餐', '晚餐'] })
  }
  for (const protein of braiseProteins) for (const prefix of ['清蒸', '蒜蓉蒸', '豉汁蒸', '剁椒蒸', '粉蒸']) yield createCombination({ name: `${prefix}${protein}`, method: '蒸', ingredients: [ingredient(protein, 220)], dishType: '蒸菜' })
  for (const protein of braiseProteins) for (const prefix of ['孜然', '黑椒', '蜜汁', '香辣', '蒜香', '炭烤']) yield createCombination({ name: `${prefix}${protein}`, method: '烤', ingredients: [ingredient(protein, 220)], dishType: '烧烤' })
  for (const vegetable of vegetables) for (const suffix of ['烧豆腐', '炖豆腐', '烩豆腐', '豆腐煲', '蒸豆腐']) yield createCombination({ name: `${vegetable}${suffix}`, method: suffix.includes('蒸') ? '蒸' : suffix.includes('炖') ? '炖' : '烧', ingredients: [ingredient(vegetable, 140), ingredient('豆腐', 220)] })
  for (const vegetable of vegetables) for (const suffix of ['鸡蛋汤', '蒸蛋', '蛋饼']) yield createCombination({ name: `${vegetable}${suffix}`, method: suffix === '鸡蛋汤' ? '煮汤' : suffix === '蒸蛋' ? '蒸' : '煎', ingredients: [ingredient(vegetable, 100), ingredient('鸡蛋', 120)], dishType: suffix === '鸡蛋汤' ? '汤羹' : '热菜' })
  for (const fruit of fruits) for (const form of ['水果羹', '银耳羹', '酸奶杯', '果茶', '果昔', '甜汤']) yield createCombination({ name: `${fruit}${form}`, method: form.includes('茶') ? '冲泡' : form.includes('杯') || form.includes('果昔') ? '调制' : '煮', ingredients: [ingredient(fruit, 180), ingredient(form.includes('银耳') ? '银耳' : form.includes('酸奶') ? '酸奶' : '水', 100)], dishType: form.includes('茶') || form.includes('果昔') ? '饮品' : '甜品', cuisine: '甜品饮品', mealTypes: ['加餐'] })
  for (let leftIndex = 0; leftIndex < vegetables.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < vegetables.length; rightIndex += 1) {
      for (const protein of sauteProteins) {
        const left = vegetables[leftIndex]
        const right = vegetables[rightIndex]
        yield createCombination({ name: `${left}${right}炒${protein}`, method: '炒', ingredients: [ingredient(left, 90), ingredient(right, 90), ingredient(protein, 150)] })
      }
    }
  }
}

function extendCoreDish(dish) {
  const isHeuristicFigure = /^figure2?$/.test(dish.source || '')
  const isExternalCandidate = dish.source === 'crawled' || dish.source === 'howtocook'
  return {
    ...dish,
    aliases: Array.isArray(dish.aliases) ? dish.aliases : [],
    regions: Array.isArray(dish.regions) && dish.regions.length ? dish.regions : cuisineRegions[dish.cuisine] || ['全国'],
    dishType: dish.dishType || (/汤|羹/.test(dish.name) ? '汤羹' : /饭|面|粉|粥|饺|包|饼/.test(dish.name) ? '主食' : '热菜'),
    mealTypes: Array.isArray(dish.mealTypes) && dish.mealTypes.length ? dish.mealTypes : ['午餐', '晚餐'],
    sourceUrl: dish.sourceUrl || dish.source_url || null,
    licenseType: dish.licenseType || 'project_owned',
    evidenceLevel: dish.evidenceLevel || (isHeuristicFigure ? 'C' : 'B'),
    reviewStatus: dish.reviewStatus || (isHeuristicFigure || isExternalCandidate ? 'candidate' : 'reviewed'),
    nutritionConfidence: dish.nutritionConfidence || 'estimated',
    publicationStatus: dish.publicationStatus || 'published',
  }
}

export function buildExpandedCatalog({ coreDishes = [], openRecipes = [], targetSize = 5_000 } = {}) {
  const target = Math.max(500, Math.min(20_000, Math.round(Number(targetSize) || 5_000)))
  const byName = new Map()
  const add = (dish) => {
    const normalizedName = normalizeDishName(dish.name)
    if (!normalizedName || byName.has(normalizedName)) return false
    byName.set(normalizedName, extendCoreDish(dish))
    return true
  }
  coreDishes.forEach(add)
  openRecipes.forEach(add)
  for (const dish of combinationCandidates()) {
    if (byName.size >= target) break
    add(dish)
  }
  if (byName.size < target) throw new Error(`组合规则只生成了 ${byName.size} 道唯一菜品，未达到 ${target}。`)
  return [...byName.values()]
}

function meaningfulIngredients(dish) {
  return (dish.ingredients || []).map((item) => item.name).filter((name) => name && !pantryIngredients.has(name)).slice(0, 6)
}

function relationWeight(left, right) {
  const leftIngredients = new Set(meaningfulIngredients(left))
  const rightIngredients = new Set(meaningfulIngredients(right))
  const shared = [...leftIngredients].filter((name) => rightIngredients.has(name))
  const union = new Set([...leftIngredients, ...rightIngredients]).size
  return {
    score: (union ? shared.length / union : 0) * 1.5
      + (left.method === right.method ? 0.28 : 0)
      + ((left.taste || []).some((taste) => (right.taste || []).includes(taste)) ? 0.22 : 0)
      + (left.cuisine === right.cuisine ? 0.16 : 0),
    reason: shared.length ? `共用${shared.slice(0, 2).join('、')}` : left.method === right.method ? `同为${left.method}` : left.cuisine === right.cuisine ? `同属${left.cuisine}` : '口味相近',
  }
}

function addWindow(candidates, list, position, radius, itemIndex) {
  if (position < 0) return
  const start = Math.max(0, position - radius)
  const end = Math.min(list.length, position + radius + 1)
  for (let index = start; index < end; index += 1) if (list[index] !== itemIndex) candidates.add(list[index])
}

export function buildTopRelations(dishes, limit = 24) {
  const safeLimit = Math.max(4, Math.min(32, Math.round(Number(limit) || 24)))
  const ingredientIndex = new Map()
  const methodIndex = new Map()
  const cuisineIndex = new Map()
  const addIndex = (map, key, dishIndex) => {
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(dishIndex)
  }
  const ingredientPositions = new Map()
  const methodPositions = new Map()
  const cuisinePositions = new Map()
  dishes.forEach((dish, dishIndex) => {
    meaningfulIngredients(dish).slice(0, 4).forEach((name) => addIndex(ingredientIndex, name, dishIndex))
    addIndex(methodIndex, dish.method, dishIndex)
    addIndex(cuisineIndex, dish.cuisine, dishIndex)
  })
  const indexPositions = (source, target) => source.forEach((list, key) => {
    const positions = new Map()
    list.forEach((dishIndex, position) => positions.set(dishIndex, position))
    target.set(key, positions)
  })
  indexPositions(ingredientIndex, ingredientPositions)
  indexPositions(methodIndex, methodPositions)
  indexPositions(cuisineIndex, cuisinePositions)
  const relations = []
  dishes.forEach((dish, dishIndex) => {
    const candidates = new Set()
    meaningfulIngredients(dish).slice(0, 4).forEach((name) => addWindow(candidates, ingredientIndex.get(name) || [], ingredientPositions.get(name)?.get(dishIndex) ?? -1, 36, dishIndex))
    addWindow(candidates, methodIndex.get(dish.method) || [], methodPositions.get(dish.method)?.get(dishIndex) ?? -1, 24, dishIndex)
    addWindow(candidates, cuisineIndex.get(dish.cuisine) || [], cuisinePositions.get(dish.cuisine)?.get(dishIndex) ?? -1, 18, dishIndex)
    const ranked = [...candidates]
      .map((candidateIndex) => ({ candidateIndex, ...relationWeight(dish, dishes[candidateIndex]) }))
      .sort((left, right) => right.score - left.score || dishes[left.candidateIndex].name.localeCompare(dishes[right.candidateIndex].name, 'zh-CN'))
      .slice(0, safeLimit)
    ranked.forEach((relation) => relations.push({ sourceId: dish.id, targetId: dishes[relation.candidateIndex].id, score: Number(Math.max(0.05, relation.score).toFixed(5)), reason: relation.reason }))
  })
  return relations
}

export function catalogQualityReport(dishes, relations = []) {
  const names = new Set()
  const duplicateNames = []
  let sparseIngredients = 0
  let estimatedNutrition = 0
  let reviewed = 0
  for (const dish of dishes) {
    const normalized = normalizeDishName(dish.name)
    if (names.has(normalized)) duplicateNames.push(dish.name)
    names.add(normalized)
    if (meaningfulIngredients(dish).length < 1) sparseIngredients += 1
    if (dish.nutritionConfidence === 'estimated') estimatedNutrition += 1
    if (['verified', 'reviewed'].includes(dish.reviewStatus)) reviewed += 1
  }
  const relationCounts = new Map()
  relations.forEach((relation) => relationCounts.set(relation.sourceId, (relationCounts.get(relation.sourceId) || 0) + 1))
  return {
    total: dishes.length,
    uniqueNames: names.size,
    duplicateNames,
    suspiciousNames: catalogQualityAudit(dishes),
    suspiciousIngredients: catalogIngredientAudit(dishes),
    reviewed,
    candidates: dishes.filter((dish) => dish.reviewStatus === 'candidate').length,
    generated: dishes.filter((dish) => dish.reviewStatus === 'generated').length,
    sparseIngredients,
    estimatedNutrition,
    sources: Object.fromEntries([...new Set(dishes.map((dish) => dish.source))].sort().map((source) => [source, dishes.filter((dish) => dish.source === source).length])),
    cuisines: Object.fromEntries([...new Set(dishes.map((dish) => dish.cuisine))].sort().map((cuisine) => [cuisine, dishes.filter((dish) => dish.cuisine === cuisine).length])),
    relations: relations.length,
    maxRelationsPerDish: Math.max(0, ...relationCounts.values()),
  }
}
