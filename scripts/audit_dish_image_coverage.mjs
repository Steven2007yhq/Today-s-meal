import 'dotenv/config'
import pg from 'pg'
import { createDishImageMatcher } from '../shared/dish-image-matcher.mjs'

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL || 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha'
const pool = new Pool({ connectionString: databaseUrl })

function classifyUnmatchedDish(dish) {
  const name = String(dish.name || '')
  const method = String(dish.method || '')
  const dishType = String(dish.dish_type || '')
  if (/包子|小笼包|灌汤包|烧卖|烧麦|馒头/.test(name)) return '包子包点'
  if (/饺子|水饺|蒸饺|煎饺|虾饺|锅贴|馄饨|云吞|抄手/.test(name)) return '饺子馄饨'
  if (/粥/.test(name) || dishType === '粥品') return '粥品'
  if (/面|米线|河粉|米粉|粉丝|粉条|凉皮|凉粉/.test(name)) return '面粉类'
  if (/饭/.test(name)) return '米饭类'
  if (/汤|羹/.test(name) || dishType === '汤羹') return '汤羹'
  if (/饮品|果茶|果昔|奶昔|豆浆|酸梅汤|果汁|茶饮/.test(`${name}${dishType}`)) return '饮品'
  if (/甜品|蛋糕|面包|布丁|糖水|甜汤|双皮奶|姜撞奶|芝麻糊|豆沙/.test(`${name}${dishType}`)) return '甜品'
  if (/烧烤|烤/.test(`${name}${method}${dishType}`)) return '烧烤'
  if (/凉菜/.test(dishType) || /凉拌|拌/.test(`${name}${method}`)) return '凉菜'
  if (/蒸/.test(method)) return '蒸菜'
  if (/炒|爆|煸/.test(method)) return '炒菜'
  if (/红烧|烧|炖|焖|烩|煲|煨/.test(method)) return '烧炖焖烩'
  if (/煎|炸|熘/.test(method)) return '煎炸'
  return '其他'
}

function dishProfileText(dish) {
  const ingredients = Array.isArray(dish.ingredients)
    ? dish.ingredients.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean)
    : []
  return `${dish.name || ''}${ingredients.join('')}`
}

function mainVisualFamily(dish) {
  const text = dishProfileText(dish)
  if (/排骨/.test(text)) return '排骨'
  if (/猪|五花肉|里脊|肉末|肉丝|肉片|肉馅|叉烧|培根|火腿|香肠/.test(text)) return '猪肉'
  if (/牛/.test(text)) return '牛肉'
  if (/羊/.test(text)) return '羊肉'
  if (/鸡(?!蛋)/.test(text)) return '鸡肉'
  if (/鸭/.test(text)) return '鸭肉'
  if (/鱼|鳕鱼|三文鱼|鳝/.test(text)) return '鱼类'
  if (/虾/.test(text)) return '虾类'
  if (/蛤|蚌|螺|鲍鱼|扇贝/.test(text)) return '贝类'
  if (/鱿鱼/.test(text)) return '鱿鱼'
  if (/鸡蛋|蛋花|蒸蛋/.test(text)) return '鸡蛋'
  if (/豆腐|腐竹|豆皮|豆干|香干/.test(text)) return '豆腐豆制品'
  if (/香菇|蘑菇|平菇|金针菇|杏鲍菇|木耳/.test(text)) return '菌菇'
  return '素菜或其他'
}

function classifyVisualSubtype(dish, category) {
  const name = String(dish.name || '')
  const family = mainVisualFamily(dish)
  if (category === '包子包点') {
    const form = /烧卖|烧麦/.test(name) ? '烧卖' : /馒头/.test(name) ? '馒头' : '包子'
    return `${form}·${family}`
  }
  if (category === '饺子馄饨') {
    const form = /馄饨|云吞|抄手/.test(name) ? '馄饨' : '饺子'
    return `${form}·${family}`
  }
  if (category === '汤羹') return `${family}汤羹`
  if (category === '米饭类') {
    if (/炒饭/.test(name)) return '炒饭'
    if (/烩饭/.test(name)) return '烩饭'
    if (/焖饭/.test(name)) return '焖饭'
    if (/煲仔饭/.test(name)) return '煲仔饭'
    if (/盖饭/.test(name)) return '盖饭'
    if (/饭团/.test(name)) return '饭团'
    return '其他米饭'
  }
  if (category === '面粉类') {
    if (/刀削面/.test(name)) return `刀削面·${family}`
    if (/河粉/.test(name)) return `河粉·${family}`
    if (/米线/.test(name)) return `米线·${family}`
    if (/汤面/.test(name)) return `汤面·${family}`
    if (/拌面|凉面/.test(name)) return `拌面·${family}`
    if (/炒面/.test(name)) return `炒面·${family}`
    return `其他面食·${family}`
  }
  if (category === '饮品') {
    if (/茶/.test(name)) return '茶饮'
    if (/奶|酸奶/.test(name)) return '奶饮'
    if (/豆浆/.test(name)) return '豆浆'
    if (/汁|果昔/.test(name)) return '果蔬饮'
    return '其他饮品'
  }
  if (category === '甜品') {
    if (/蛋糕|面包|派|提拉米苏/.test(name)) return '烘焙甜点'
    if (/糖水|甜汤|豆沙|芝麻糊/.test(name)) return '糖水甜汤'
    if (/布丁|双皮奶|姜撞奶/.test(name)) return '奶制甜品'
    return '其他甜品'
  }
  return family
}

try {
  const [dishResult, exactResult, candidateResult] = await Promise.all([
    pool.query(
      `SELECT id, name, cuisine, method, taste, ingredients, dish_type
       FROM catalog.dishes
       WHERE publication_status = 'published'
       ORDER BY name`,
    ),
    pool.query(
      `SELECT DISTINCT image.dish_id
       FROM media.dish_images image
       JOIN catalog.dishes dish ON dish.id = image.dish_id
       WHERE image.deleted_at IS NULL AND dish.publication_status = 'published'`,
    ),
    pool.query(
      `SELECT DISTINCT ON (image.dish_id)
         image.*,
         COALESCE(NULLIF(image.metadata->>'visualName', ''), dish.name) AS name,
         COALESCE(NULLIF(image.metadata->>'visualCuisine', ''), dish.cuisine) AS cuisine,
         COALESCE(NULLIF(image.metadata->>'visualMethod', ''), dish.method) AS method,
         COALESCE(image.metadata->'visualTaste', dish.taste, '[]'::jsonb) AS taste,
         COALESCE(image.metadata->'visualIngredients', dish.ingredients, '[]'::jsonb) AS ingredients,
         COALESCE(NULLIF(image.metadata->>'visualDishType', ''), dish.dish_type) AS dish_type
       FROM media.dish_images image
       LEFT JOIN catalog.dishes dish ON dish.id = image.dish_id
       WHERE image.deleted_at IS NULL
         AND (dish.publication_status = 'published' OR image.metadata->>'collection' LIKE 'category-reference%')
       ORDER BY image.dish_id, image.created_at DESC`,
    ),
  ])

  const exactDishIds = new Set(exactResult.rows.map((row) => row.dish_id))
  const findImageMatch = createDishImageMatcher(candidateResult.rows)
  const unmatched = []
  const categoryReferenceUsage = new Map()
  let fallbackCount = 0

  for (const dish of dishResult.rows) {
    if (exactDishIds.has(dish.id)) continue
    const match = findImageMatch(dish)
    if (!match) {
      unmatched.push(dish)
      continue
    }
    fallbackCount += 1
    if (String(match.candidate.dish_id || '').startsWith('category-ref-')) {
      const key = match.candidate.name
      const usage = categoryReferenceUsage.get(key) || { count: 0, samples: [] }
      usage.count += 1
      if (usage.samples.length < 5) usage.samples.push(dish.name)
      categoryReferenceUsage.set(key, usage)
    }
  }

  const classCounts = new Map()
  const subtypeCounts = new Map()
  for (const dish of unmatched) {
    const category = classifyUnmatchedDish(dish)
    classCounts.set(category, (classCounts.get(category) || 0) + 1)
    const subtype = `${category} / ${classifyVisualSubtype(dish, category)}`
    subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1)
  }

  const total = dishResult.rowCount
  const exact = exactDishIds.size
  const covered = exact + fallbackCount
  console.log(`Published dishes: ${total}`)
  console.log(`Exact images: ${exact}`)
  console.log(`Conservative similar-image matches: ${fallbackCount}`)
  console.log(`Covered total: ${covered} (${(covered / total * 100).toFixed(1)}%)`)
  console.log(`Still unmatched: ${unmatched.length}`)
  console.log('\nCategory reference usage:')
  console.table([...categoryReferenceUsage.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0], 'zh-CN'))
    .map(([category, usage]) => ({ category, count: usage.count, samples: usage.samples.join('、') })))
  console.log('\nRemaining unmatched classes:')
  console.table([...classCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .map(([category, count]) => ({ category, count })))
  console.log('\nPriority unmatched visual subtypes:')
  console.table([...subtypeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, 40)
    .map(([category, count]) => ({ category, count })))
} finally {
  await pool.end()
}
