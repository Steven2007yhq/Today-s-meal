import { dishById, dishes } from '../data/dishLibrary'

const mealCalorieTargets = { 早餐: 450, 午餐: 650, 晚餐: 520, 加餐: 220 }
const pantryIngredients = new Set(['食用油', '生姜', '小葱', '食盐', '酱油', '白糖', '淀粉', '大蒜'])
const importantSingleCharTerms = new Set(['鸡', '鸭', '鱼', '虾', '蟹', '肉', '牛', '羊', '猪', '蛋', '豆', '饭', '面', '粉', '粥', '饺', '包', '汤', '辣', '甜', '蒸', '炒', '炖', '炸', '烤', '卤'])

const domainAliasGroups = [
  ['饺子', '水饺', '蒸饺', '煎饺', '锅贴', '饺', 'jiaozi', 'shuijiao', 'dumpling'],
  ['包子', '小笼包', '生煎', '灌汤包', '包', 'baozi', 'bun'],
  ['面条', '面', '拉面', '拌面', '汤面', '炒面', 'noodle', 'mian'],
  ['米饭', '饭', '炒饭', '盖饭', '盖浇饭', '煲仔饭', 'rice', 'fan'],
  ['米粉', '粉', '河粉', '肠粉', '螺蛳粉', '粉丝', 'fen'],
  ['猪肉', '猪', '五花肉', '猪里脊', '里脊肉', '排骨', '肉馅', '猪肉馅', 'pork', 'zhurou'],
  ['牛肉', '牛', '黄牛肉', '牛腩', '牛腱', '牛肚', 'beef', 'niurou'],
  ['羊肉', '羊', '羊排', '羊腿', 'mutton', 'lamb', 'yangrou'],
  ['鸡肉', '鸡', '鸡胸', '鸡胸肉', '鸡腿', '鸡翅', '鸡丁', '三黄鸡', 'chicken', 'jirou'],
  ['鸭肉', '鸭', '鸭腿', '盐水鸭', 'duck', 'yarou'],
  ['鱼', '鱼肉', '鱼片', '鱼头', '鲈鱼', '草鱼', '黑鱼', '鳜鱼', '石斑鱼', 'fish', 'yu'],
  ['虾', '虾仁', '河虾仁', '大虾', 'shrimp', 'xiaren', 'xia'],
  ['豆腐', '豆制品', '北豆腐', '毛豆腐', '豆', 'tofu', 'doufu'],
  ['鸡蛋', '蛋', '蛋清', '蒸蛋', 'egg', 'dan'],
  ['白菜', '大白菜', '小白菜', '娃娃菜', '青菜', '蔬菜', 'baicai', 'cabbage'],
  ['青椒', '辣椒', '尖椒', '小米辣', '干辣椒', '彩椒', 'pepper', 'lajiao'],
  ['土豆', '马铃薯', '洋芋', 'potato', 'tudou'],
  ['番茄', '西红柿', '番茄酱', 'tomato', 'fanqie', 'xihongshi'],
  ['香菇', '蘑菇', '菌菇', '口蘑', 'mushroom', 'xianggu'],
  ['葱', '大葱', '小葱', '葱香', 'cong'],
  ['蒜', '大蒜', '青蒜', '蒜蓉', '蒜香', 'suan'],
  ['姜', '生姜', '姜葱', 'jiang'],
  ['清淡', '少油', '低脂', '低卡', '减脂', '轻食', '健身', '控脂', 'light', 'diet'],
  ['高蛋白', '蛋白', '增肌', '健身餐', 'protein'],
  ['麻辣', '香辣', '鲜辣', '辣', '重口味', '川味', 'mala', 'spicy'],
  ['酸甜', '糖醋', '酸', '甜', 'suantian'],
  ['咸鲜', '鲜香', '清鲜', '鲜嫩', '鲜', 'xian'],
  ['红烧', '烧', '焖', '炖', '煨', '卤', 'hongshao', 'braise'],
  ['清蒸', '蒸', '蒸菜', 'qingzheng', 'steam'],
  ['爆炒', '滑炒', '小炒', '炒', 'chaocai', 'stirfry'],
  ['油炸', '炸', '炸熘', '酥香', 'fried'],
  ['烧烤', '烤', '挂炉烤', '烘烤', 'roast', 'bbq'],
  ['凉拌', '卤拌', '拌', '凉菜', 'cold'],
  ['早餐', '早饭', '早点', '早茶', 'breakfast'],
  ['午餐', '午饭', '正餐', 'lunch'],
  ['晚餐', '晚饭', 'dinner'],
  ['家常菜', '家常', '下饭', '快手菜', 'home'],
  ['节日美食', '节日', '生日', '聚餐', '宴客菜', '宴席', 'festival'],
  ['鲁菜', '山东菜', 'shandong', 'lucai'],
  ['川菜', '四川菜', '川味', 'sichuan', 'chuancai'],
  ['粤菜', '广东菜', '广式', 'cantonese', 'yuecai'],
  ['苏菜', '江苏菜', '淮扬菜', 'sucai'],
  ['闽菜', '福建菜', 'mincai'],
  ['浙菜', '浙江菜', 'zhecai'],
  ['湘菜', '湖南菜', 'xiangcai'],
  ['徽菜', '安徽菜', 'huicai'],
  ['东北菜', '东北', 'dongbei'],
  ['宫保鸡丁', '宫保', '宫爆', '鸡丁', 'gongbao', 'gongbaojiding', 'gbjd'],
  ['麻婆豆腐', '麻婆', 'mapo', 'mapodoufu', 'mpdf'],
  ['水煮鱼', '水煮', 'shuizhuyu', 'szy'],
  ['白切鸡', '白斩鸡', 'baiqieji', 'bzj'],
  ['佛跳墙', 'fotiaoqiang', 'ftq'],
]

const latinHintGroups = [
  ['饺子', ['jiaozi', 'shuijiao', 'dumpling', 'jz']],
  ['宫保鸡丁', ['gongbaojiding', 'gbjd']],
  ['宫保', ['gongbao', 'gb']],
  ['鸡丁', ['jiding', 'jd']],
  ['麻婆豆腐', ['mapodoufu', 'mpdf']],
  ['麻婆', ['mapo', 'mp']],
  ['水煮鱼', ['shuizhuyu', 'szy']],
  ['白切鸡', ['baiqieji', 'bqj', 'baizhanji', 'bzj']],
  ['佛跳墙', ['fotiaoqiang', 'ftq']],
  ['清蒸', ['qingzheng', 'qz', 'steam']],
  ['红烧', ['hongshao', 'hs', 'braise']],
  ['爆炒', ['baochao', 'bc']],
  ['小炒', ['xiaochao', 'xc']],
  ['麻辣', ['mala', 'ml', 'spicy']],
  ['酸甜', ['suantian', 'st']],
  ['川菜', ['chuancai', 'cc', 'sichuan']],
  ['粤菜', ['yuecai', 'yc', 'cantonese']],
  ['鲁菜', ['lucai', 'lc', 'shandong']],
  ['苏菜', ['sucai', 'sc']],
  ['闽菜', ['mincai', 'mc']],
  ['浙菜', ['zhecai', 'zc']],
  ['湘菜', ['xiangcai', 'xc']],
  ['徽菜', ['huicai', 'hc']],
  ['东北菜', ['dongbeicai', 'dbc']],
  ['家常菜', ['jiachangcai', 'jcc', 'home']],
  ['猪肉', ['zhurou', 'zr', 'pork']],
  ['牛肉', ['niurou', 'nr', 'beef']],
  ['羊肉', ['yangrou', 'yr', 'lamb', 'mutton']],
  ['鸡肉', ['jirou', 'jr', 'chicken']],
  ['鸭肉', ['yarou', 'yr', 'duck']],
  ['鱼', ['yu', 'fish']],
  ['虾', ['xia', 'shrimp']],
  ['豆腐', ['doufu', 'df', 'tofu']],
  ['白菜', ['baicai', 'bc', 'cabbage']],
  ['青椒', ['qingjiao', 'qj', 'pepper']],
  ['番茄', ['fanqie', 'fq', 'xihongshi', 'xhs', 'tomato']],
  ['土豆', ['tudou', 'td', 'potato']],
  ['米饭', ['mifan', 'mf', 'rice']],
  ['面条', ['miantiao', 'mt', 'noodle']],
]

const aliasGroups = domainAliasGroups
  .map((group) => [...new Set(group.map((term) => compactSearchText(term)).filter(Boolean))])
  .filter((group) => group.length > 1)

const aliasLookup = new Map()
for (const group of aliasGroups) {
  for (const term of group) aliasLookup.set(term, group)
}

let knownTermsCache
const dishSearchDocumentCache = new Map()

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundToFive(value) {
  return Math.max(1, Math.round(value / 5) * 5)
}

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[，。、“”‘’；;：:！!？?（）()[\]{}<>《》【】、/\\|·•…~`^"'￥$%&*=+_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactSearchText(value = '') {
  return normalizeSearchText(value).replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

function unique(values) {
  return [...new Set(values.map((value) => compactSearchText(value)).filter(Boolean))]
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function hasChinese(value) {
  return /[\u4e00-\u9fff]/.test(value)
}

function buildKnownTerms() {
  if (knownTermsCache) return knownTermsCache
  const terms = new Set([...importantSingleCharTerms])
  for (const group of domainAliasGroups) {
    for (const term of group) terms.add(term)
  }
  for (const dish of dishes) {
    for (const term of [
      dish.name,
      dish.cuisine,
      dish.method,
      ...safeArray(dish.taste),
      ...safeArray(dish.tags),
      ...safeArray(dish.ingredients).map((item) => item.name),
    ]) {
      const normalized = compactSearchText(term)
      if (normalized.length > 1 || importantSingleCharTerms.has(normalized)) terms.add(normalized)
    }
  }
  knownTermsCache = [...terms]
    .map((term) => compactSearchText(term))
    .filter((term) => term.length > 1 || importantSingleCharTerms.has(term))
    .sort((left, right) => right.length - left.length)
  return knownTermsCache
}

function getAliasTerms(term) {
  const normalized = compactSearchText(term)
  return aliasLookup.get(normalized) || [normalized]
}

function extractKnownTerms(source) {
  if (!source) return []
  const hits = []
  for (const term of buildKnownTerms()) {
    if (source.includes(term)) hits.push(term)
  }
  return hits
}

function splitQueryTerms(query) {
  const normalized = normalizeSearchText(query)
  const parts = normalized.split(' ').filter(Boolean)
  const terms = []
  for (const part of parts) {
    terms.push(part)
    const compacted = compactSearchText(part)
    if (compacted !== part) terms.push(compacted)
  }
  return terms
}

function expandLatinInput(query) {
  const compactedLatin = normalizeSearchText(query).replace(/[^a-z0-9]+/g, '')
  if (compactedLatin.length < 2) return []
  const hits = []
  for (const group of aliasGroups) {
    const latinTerms = group.filter((term) => /^[a-z0-9]+$/.test(term))
    if (!latinTerms.length) continue
    if (latinTerms.some((term) => compactedLatin.includes(term) || (compactedLatin.length >= 3 && term.includes(compactedLatin)))) {
      hits.push(...group.filter((term) => hasChinese(term)))
    }
  }
  return hits
}

export function analyzeDishQuery(query = '') {
  const normalized = normalizeSearchText(query)
  const compacted = compactSearchText(query)
  if (!compacted) {
    return {
      raw: String(query || ''),
      normalized,
      compacted,
      tokens: [],
      expandedTokens: [],
      displayTokens: [],
      isEmpty: true,
    }
  }

  const directTokens = splitQueryTerms(query)
  const knownTokens = extractKnownTerms(compacted)
  const latinTokens = expandLatinInput(query)
  const tokens = unique([...directTokens, ...knownTokens, ...latinTokens])
  const expandedTokens = unique(tokens.flatMap((token) => getAliasTerms(token))).filter((token) => !tokens.includes(token))
  const displayTokens = unique([...knownTokens, ...latinTokens, ...expandedTokens])
    .filter((token) => hasChinese(token) && (token.length > 1 || importantSingleCharTerms.has(token)))
    .slice(0, 8)

  return {
    raw: String(query || ''),
    normalized,
    compacted,
    tokens,
    expandedTokens,
    displayTokens,
    isEmpty: false,
  }
}

function latinHintsFor(text) {
  const compacted = compactSearchText(text)
  const hints = []
  for (const [term, values] of latinHintGroups) {
    if (compacted.includes(compactSearchText(term))) hints.push(...values)
  }
  return compactSearchText(hints.join(' '))
}

function makeSearchDocument(dish) {
  const cacheKey = dish.id || dish.name
  if (dishSearchDocumentCache.has(cacheKey)) return dishSearchDocumentCache.get(cacheKey)
  const ingredientNames = safeArray(dish.ingredients).map((item) => item.name)
  const taste = safeArray(dish.taste)
  const tags = safeArray(dish.tags)
  const fields = {
    name: compactSearchText(dish.name),
    cuisine: compactSearchText(dish.cuisine),
    method: compactSearchText(dish.method),
    taste: compactSearchText(taste.join(' ')),
    tags: compactSearchText(tags.join(' ')),
    ingredients: compactSearchText(ingredientNames.join(' ')),
  }
  const allText = Object.values(fields).join('')
  const document = {
    ...fields,
    allText,
    latin: latinHintsFor(allText),
  }
  dishSearchDocumentCache.set(cacheKey, document)
  return document
}

function boundedLevenshtein(left, right) {
  if (!left || !right) return Math.max(left.length, right.length)
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array(right.length + 1)
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      )
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j]
  }
  return previous[right.length]
}

function fieldMatchScore(document, token, isExpanded = false) {
  const normalized = compactSearchText(token)
  if (!normalized) return 0
  const shortPenalty = normalized.length === 1 && !importantSingleCharTerms.has(normalized) ? 0.35 : 1
  const factor = (isExpanded ? 0.72 : 1) * shortPenalty
  let score = 0

  if (document.name === normalized) score += 330
  else if (document.name.includes(normalized)) score += 185
  else if (normalized.length >= 2 && normalized.includes(document.name)) score += 110

  if (document.ingredients.includes(normalized)) score += 72
  if (document.method.includes(normalized)) score += 58
  if (document.cuisine.includes(normalized)) score += 48
  if (document.taste.includes(normalized)) score += 44
  if (document.tags.includes(normalized)) score += 34
  if (normalized.length >= 2 && document.allText.includes(normalized)) score += 24
  if (/^[a-z0-9]+$/.test(normalized) && normalized.length >= 2 && document.latin.includes(normalized)) score += 86

  return score * factor
}

function fuzzyNameScore(document, analysis) {
  const query = analysis.compacted
  if (!query || query.length < 2 || query.length > 16 || !document.name) return 0
  const distance = boundedLevenshtein(query, document.name)
  const ratio = 1 - distance / Math.max(query.length, document.name.length)
  return ratio >= 0.48 ? ratio * 78 : 0
}

function scoreDish(dish, analysis) {
  const document = makeSearchDocument(dish)
  let score = 0
  if (document.name === analysis.compacted) score += 420
  else if (document.name.includes(analysis.compacted)) score += 260
  else if (document.allText.includes(analysis.compacted)) score += 95

  for (const token of analysis.tokens) score += fieldMatchScore(document, token, false)
  for (const token of analysis.expandedTokens) score += fieldMatchScore(document, token, true)
  score += fuzzyNameScore(document, analysis)

  const matchedOriginalTokens = analysis.tokens.filter((token) => token.length > 1 && document.allText.includes(token)).length
  if (matchedOriginalTokens >= 2) score += 42
  if (analysis.displayTokens.length && analysis.displayTokens.some((token) => document.name.includes(token))) score += 35
  return score
}

export function searchDishes(query = '', cuisine = 'all') {
  const analysis = analyzeDishQuery(query)
  const candidateDishes = dishes.filter((dish) => cuisine === 'all' || dish.cuisine === cuisine)
  if (analysis.isEmpty) return candidateDishes

  return candidateDishes
    .map((dish, index) => ({ dish, index, score: scoreDish(dish, analysis) }))
    .filter((item) => item.score >= 24)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.dish)
}

export function calculateDishPortion(dish, mealHistory = [], mealType = '午餐', householdSize = 1) {
  const relevantHistory = mealHistory.filter((entry) => entry.type === mealType && Number(entry.portionMultiplier) > 0)
  const historicalFactor = relevantHistory.length
    ? relevantHistory.reduce((total, entry) => total + Number(entry.portionMultiplier), 0) / relevantHistory.length
    : 1
  const targetCalories = mealCalorieTargets[mealType] || mealCalorieTargets.午餐
  const nutritionFactor = targetCalories / dish.nutrition.calories
  const perPersonFactor = clamp(historicalFactor * 0.58 + nutritionFactor * 0.42, 0.65, 1.55)
  const totalFactor = perPersonFactor * Math.max(1, householdSize)

  return {
    multiplier: Number(perPersonFactor.toFixed(2)),
    householdSize,
    ingredients: dish.ingredients.map((ingredient) => ({
      ...ingredient,
      grams: roundToFive(ingredient.grams * totalFactor),
    })),
    nutrition: Object.fromEntries(Object.entries(dish.nutrition).map(([key, value]) => [key, Math.round(value * perPersonFactor)])),
    confidence: relevantHistory.length >= 6 ? '高' : relevantHistory.length >= 2 ? '中' : '起步',
    reason: relevantHistory.length
      ? `参考了 ${relevantHistory.length} 次${mealType}饭量记录，并对齐约 ${targetCalories} kcal 的单餐目标。`
      : `暂按标准成人份与约 ${targetCalories} kcal 的单餐目标估算，记录越多会越懂你的饭量。`,
  }
}

function sharedIngredientScore(leftDish, rightDish) {
  const leftIngredients = new Set(leftDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const rightIngredients = new Set(rightDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const intersection = [...leftIngredients].filter((name) => rightIngredients.has(name)).length
  const union = new Set([...leftIngredients, ...rightIngredients]).size
  return union ? intersection / union : 0
}

function relationWeight(leftDish, rightDish) {
  const ingredientScore = sharedIngredientScore(leftDish, rightDish)
  const methodScore = leftDish.method === rightDish.method ? 0.28 : 0
  const tasteScore = (leftDish.taste || []).some((taste) => (rightDish.taste || []).includes(taste)) ? 0.22 : 0
  const cuisineScore = leftDish.cuisine === rightDish.cuisine ? 0.22 : 0
  return Math.max(0.05, ingredientScore * 1.5 + methodScore + tasteScore + cuisineScore)
}

export function buildDishGraph() {
  const graph = new Map(dishes.map((dish) => [dish.id, []]))
  for (let leftIndex = 0; leftIndex < dishes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < dishes.length; rightIndex += 1) {
      const leftDish = dishes[leftIndex]
      const rightDish = dishes[rightIndex]
      const score = relationWeight(leftDish, rightDish)
      graph.get(leftDish.id).push({ id: rightDish.id, score, reasons: getRelationReasons(leftDish, rightDish) })
      graph.get(rightDish.id).push({ id: leftDish.id, score, reasons: getRelationReasons(rightDish, leftDish) })
    }
  }
  graph.forEach((edges) => edges.sort((left, right) => right.score - left.score))
  return graph
}

function getRelationReasons(leftDish, rightDish) {
  const sharedIngredients = leftDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name) && rightDish.ingredients.some((item) => item.name === name))
  if (sharedIngredients.length) return `共用${sharedIngredients.slice(0, 2).join('、')}`
  if (leftDish.method === rightDish.method) return `同为${leftDish.method}`
  const sharedTaste = (leftDish.taste || []).find((taste) => (rightDish.taste || []).includes(taste))
  return sharedTaste ? `同属${sharedTaste}风味` : '同菜系变化'
}

const dishGraph = buildDishGraph()

export function getRelatedDishes(dishId, limit = 4) {
  return (dishGraph.get(dishId) || []).slice(0, limit).map((edge) => ({
    ...dishById.get(edge.id),
    relationScore: Math.round(edge.score * 100),
    relationReason: edge.reasons,
  }))
}

export function getDishGraphStats() {
  const edgeCount = [...dishGraph.values()].reduce((total, edges) => total + edges.length, 0) / 2
  return { nodes: dishes.length, edges: edgeCount }
}
