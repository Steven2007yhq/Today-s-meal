import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const projectRoot = path.resolve(import.meta.dirname, '..')
const seedPath = path.join(projectRoot, 'src', 'data', 'figureDishSeed.json')
const outputPath = path.join(projectRoot, 'src', 'data', 'figureDishLibrary.json')
const figureDirectory = path.resolve(process.argv[2] || process.env.FIGURE_IMAGE_DIR || path.join(os.homedir(), 'Desktop', '今天吃啥', 'figure'))
const databaseUrl = process.env.DATABASE_URL || 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha'

const pantryIngredients = new Set(['食用油', '生姜', '小葱', '食盐', '酱油', '白糖', '淀粉', '大蒜'])
const recipeOverrides = {
  酸菜粉: [['酸菜', 140], ['粉条', 110], ['猪肉', 60]],
  地丝地瓜: [['地瓜', 180], ['青椒', 50], ['猪肉', 50]],
  姜撞奶: [['牛奶', 260], ['生姜', 18], ['白糖', 10]],
  尖椒干豆腐: [['干豆腐', 180], ['尖椒', 90], ['猪肉', 50]],
  小鸡炖蘑菇: [['鸡肉', 220], ['榛蘑', 80], ['粉条', 60]],
  红豆沙: [['红豆', 100], ['牛奶', 120], ['白糖', 12]],
  杀猪菜: [['酸菜', 160], ['猪肉', 120], ['血肠', 80]],
  拔丝地瓜: [['地瓜', 220], ['白糖', 25], ['食用油', 15]],
  芝麻糊: [['黑芝麻', 55], ['糯米粉', 35], ['牛奶', 180]],
  绿豆沙: [['绿豆', 100], ['牛奶', 120], ['白糖', 12]],
  双皮奶: [['牛奶', 260], ['蛋清', 45], ['白糖', 12]],
  锅包肉: [['猪里脊', 180], ['淀粉', 35], ['胡萝卜', 30]],
  糟溜鱼片: [['鱼片', 220], ['木耳', 50], ['香糟汁', 25]],
  牛肉面: [['面条', 180], ['牛肉', 120], ['青菜', 70]],
  柳叶丸子: [['猪肉', 180], ['青菜', 100], ['香菇', 45]],
  佛跳墙: [['海参', 60], ['鲍鱼', 60], ['鸡肉', 80], ['香菇', 40]],
  皮蛋豆腐: [['皮蛋', 80], ['嫩豆腐', 220], ['小葱', 12]],
  绍鱼丝: [['鱼丝', 180], ['香菇', 50], ['青椒', 50]],
  松鼠桂鱼: [['鳜鱼', 280], ['番茄酱', 35], ['淀粉', 30]],
  软炊长鱼: [['鳝鱼', 220], ['青椒', 60], ['洋葱', 50]],
  符离集烧鸡: [['整鸡', 320], ['八角', 3], ['桂皮', 3]],
  荔枝肉: [['猪里脊', 180], ['荸荠', 60], ['番茄酱', 30]],
  糖醋黄河鲤鱼: [['鲤鱼', 300], ['番茄酱', 35], ['淀粉', 30]],
  清炖蟹粉狮子头: [['猪肉', 190], ['蟹粉', 45], ['青菜', 100]],
  地三鲜: [['茄子', 130], ['土豆', 130], ['青椒', 70]],
  油爆双脆: [['猪肚', 120], ['鸡胗', 120], ['青椒', 60]],
  宋嫂鱼羹: [['鱼肉', 160], ['鸡蛋', 60], ['香菇', 45]],
  馄饨汤: [['馄饨皮', 120], ['猪肉', 90], ['虾仁', 45], ['紫菜', 8]],
  鸡汤汆海蚌: [['海蚌', 180], ['鸡肉', 100], ['高汤', 220]],
  家常火锅: [['牛肉', 100], ['豆腐', 100], ['菌菇', 100], ['青菜', 120]],
  粉蒸肉: [['五花肉', 200], ['米粉', 55], ['南瓜', 120]],
  西湖醋鱼: [['草鱼', 280], ['香醋', 25], ['白糖', 18]],
  腊味合蒸: [['腊肉', 100], ['腊肠', 100], ['腊鱼', 100]],
  杭州蟹粉狮子头: [['猪肉', 190], ['蟹粉', 45], ['青菜', 100]],
  干炸响铃: [['豆腐皮', 150], ['猪肉', 90], ['淀粉', 20]],
  韭菜猪肉饺子: [['饺子皮', 160], ['猪肉', 120], ['韭菜', 100]],
  凉面: [['面条', 180], ['黄瓜', 80], ['花生', 20]],
  淡糟香螺片: [['海螺', 220], ['香糟汁', 25], ['青菜', 70]],
  宁波年糕: [['年糕', 200], ['猪肉', 70], ['青菜', 100]],
  清汤刀削面: [['刀削面', 190], ['青菜', 90], ['香菇', 45]],
  生炒虾饺: [['饺子皮', 130], ['虾仁', 160], ['青菜', 80]],
  水饺: [['饺子皮', 160], ['猪肉', 110], ['白菜', 110]],
}

const ingredientRules = [
  [/排骨/, ['猪排骨', 220]], [/猪蹄/, ['猪蹄', 240]], [/鸡爪/, ['鸡爪', 220]], [/鸡翅/, ['鸡翅', 220]],
  [/鸡丁|鸡块|盐酥鸡|香妃鸡|花雕鸡|叫花鸡/, ['鸡肉', 220]], [/牛肉/, ['牛肉', 190]], [/羊肉/, ['羊肉', 200]],
  [/红烧肉|东坡肉|小炒肉|炒肉|翠香肉|溜肉段|锅包肉|里脊|荔枝肉/, ['猪肉', 190]],
  [/鱼头/, ['鱼头', 300]], [/鲤鱼/, ['鲤鱼', 280]], [/桂鱼|鳜鱼/, ['鳜鱼', 280]], [/鱼/, ['鱼肉', 240]],
  [/大虾|虾仁|虾饺/, ['虾仁', 200]], [/鱿鱼/, ['鱿鱼', 220]], [/花蛤/, ['花蛤', 260]], [/鲍鱼/, ['鲍鱼', 90]],
  [/蟹粉/, ['蟹粉', 45]], [/豆腐|毛豆腐/, ['豆腐', 230]], [/腐竹/, ['腐竹', 150]], [/干豆腐/, ['干豆腐', 180]],
  [/炒蛋|鸡蛋|蛋花|蒸蛋|蛋炒饭/, ['鸡蛋', 120]], [/皮蛋/, ['皮蛋', 90]],
  [/土豆/, ['土豆', 180]], [/地瓜/, ['地瓜', 200]], [/茄子/, ['茄子', 200]], [/苦瓜/, ['苦瓜', 180]],
  [/丝瓜/, ['丝瓜', 190]], [/菠菜/, ['菠菜', 200]], [/四季豆|油豆角/, ['四季豆', 200]], [/西蓝花/, ['西蓝花', 180]],
  [/胡萝卜/, ['胡萝卜', 140]], [/青椒|尖椒/, ['青椒', 110]], [/香菇|蘑菇/, ['香菇', 90]], [/白菜/, ['白菜', 220]],
  [/炒面|牛肉面|刀削面|凉面/, ['面条', 190]], [/炒饭/, ['米饭', 220]], [/年糕/, ['年糕', 200]],
]

const nutritionProfiles = [
  [/食用油/, [899, 0, 0, 100, 0, 0]], [/猪排骨|猪蹄|五花肉|腊肉/, [320, 18, 0, 27, 0, 85]],
  [/猪肉|猪里脊/, [190, 25, 0, 10, 0, 65]], [/鸡爪|鸡翅|鸡肉|整鸡/, [210, 25, 0, 12, 0, 80]],
  [/牛肉|羊肉/, [210, 27, 0, 11, 0, 75]], [/鱼|鳝鱼|鲤鱼|鳜鱼/, [125, 22, 0, 4, 0, 65]],
  [/虾|海蚌|花蛤|海螺|鲍鱼|鱿鱼|海参|蟹粉/, [105, 20, 3, 2, 0, 180]],
  [/鸡蛋|蛋清|皮蛋/, [145, 13, 2, 10, 0, 140]], [/牛奶/, [54, 3.2, 5, 3, 0, 45]],
  [/豆腐|豆腐皮|干豆腐|腐竹/, [145, 14, 8, 8, 2, 30]], [/面条|粉条|米饭|年糕|饺子皮|馄饨皮|刀削面|米粉|糯米粉/, [230, 6, 48, 2, 2, 20]],
  [/红豆|绿豆|花生|黑芝麻/, [340, 20, 45, 12, 10, 12]], [/土豆|地瓜|南瓜/, [88, 2, 20, 0.3, 2.5, 8]],
  [/青椒|尖椒|胡萝卜|茄子|苦瓜|丝瓜|菠菜|四季豆|西蓝花|白菜|青菜|黄瓜|韭菜|酸菜/, [32, 2, 6, 0.4, 2.5, 30]],
  [/香菇|蘑菇|榛蘑|菌菇|木耳/, [35, 3, 7, 0.5, 3.5, 15]], [/白糖|番茄酱/, [300, 1, 74, 0, 0.5, 300]],
]

function uniqueIngredients(items) {
  const result = new Map()
  for (const [name, grams] of items) if (!result.has(name)) result.set(name, { name, grams })
  return [...result.values()]
}

function ingredientsFor(name, method) {
  const override = recipeOverrides[name]
  const matched = override ? [...override] : ingredientRules.filter(([pattern]) => pattern.test(name)).map(([, ingredient]) => ingredient)
  if (!matched.length) matched.push(['猪肉', 160], ['青菜', 100])
  if (/炒|爆|煎|炸|熘|烧|焖/.test(method) && !matched.some(([ingredient]) => ingredient === '食用油')) matched.push(['食用油', /炸/.test(method) ? 20 : 10])
  if (/肉|鸡|鱼|虾|排骨|蹄|海|蚌|蛤|螺|鱿/.test(name)) matched.push(['生姜', 12])
  if (!/甜品|沙|奶|糊/.test(name)) matched.push(['小葱', 12])
  return uniqueIngredients(matched).slice(0, 6)
}

function profileFor(ingredientName) {
  return nutritionProfiles.find(([pattern]) => pattern.test(ingredientName))?.[1] || [70, 3, 10, 2, 1, 80]
}

function nutritionFor(ingredients) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
  for (const ingredient of ingredients) {
    const [calories, protein, carbs, fat, fiber, sodium] = profileFor(ingredient.name)
    const factor = ingredient.grams / 100
    totals.calories += calories * factor
    totals.protein += protein * factor
    totals.carbs += carbs * factor
    totals.fat += fat * factor
    totals.fiber += fiber * factor
    totals.sodium += sodium * factor
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 10) / 10]))
}

function tastesFor(name, method) {
  const tastes = []
  if (/酸菜|醋|酸辣|糖醋|锅包|荔枝/.test(name)) tastes.push('酸甜')
  if (/辣|尖椒|青椒|剁椒|麻婆|鱼香|宫保/.test(name)) tastes.push('香辣')
  if (/甜|沙|奶|糊|拔丝/.test(name)) tastes.push('香甜')
  if (/蒸|炖|煮|汆|汤|羹/.test(method)) tastes.push('清鲜')
  if (/炸|煎|爆/.test(method)) tastes.push('酥香')
  if (/红烧|烧|焖|卤/.test(method)) tastes.push('咸鲜')
  return [...new Set(tastes.length ? tastes : ['家常鲜香'])].slice(0, 2)
}

function relationReason(leftDish, rightDish) {
  const rightIngredients = new Set(rightDish.ingredients.map((item) => item.name))
  const shared = leftDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name) && rightIngredients.has(name))
  if (shared.length) return `共用${shared.slice(0, 2).join('、')}`
  if (leftDish.method === rightDish.method) return `同为${leftDish.method}`
  const sharedTaste = leftDish.taste.find((taste) => rightDish.taste.includes(taste))
  return sharedTaste ? `同属${sharedTaste}风味` : `同属${leftDish.cuisine}`
}

function relationScore(leftDish, rightDish) {
  const leftIngredients = new Set(leftDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const rightIngredients = new Set(rightDish.ingredients.map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const intersection = [...leftIngredients].filter((name) => rightIngredients.has(name)).length
  const union = new Set([...leftIngredients, ...rightIngredients]).size
  return Math.max(0.05, (union ? intersection / union : 0) * 1.5
    + (leftDish.method === rightDish.method ? 0.28 : 0)
    + (leftDish.taste.some((taste) => rightDish.taste.includes(taste)) ? 0.22 : 0)
    + (leftDish.cuisine === rightDish.cuisine ? 0.22 : 0))
}

async function listImageFiles(directory, recursive = false) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
      files.push({ filePath: fullPath, fileName: entry.name })
      continue
    }
    if (recursive && entry.isDirectory()) {
      files.push(...await listImageFiles(fullPath, true))
    }
  }
  return files.sort((left, right) => left.fileName.localeCompare(right.fileName, 'zh-CN'))
}

async function resolveFigureImageSourceDirectory(rootDirectory, expectedCount) {
  const directFiles = await listImageFiles(rootDirectory, false)
  if (directFiles.length === expectedCount) {
    return { directory: rootDirectory, imageFiles: directFiles }
  }
  const childEntries = await fs.readdir(rootDirectory, { withFileTypes: true })
  const candidates = []
  for (const entry of childEntries) {
    if (!entry.isDirectory()) continue
    const childDirectory = path.join(rootDirectory, entry.name)
    const childFiles = await listImageFiles(childDirectory, true)
    if (childFiles.length === expectedCount) {
      candidates.push({ directory: childDirectory, imageFiles: childFiles })
    }
  }
  if (candidates.length) {
    candidates.sort((left, right) => left.directory.localeCompare(right.directory, 'zh-CN'))
    return candidates[0]
  }
  if (directFiles.length > expectedCount) {
    return { directory: rootDirectory, imageFiles: directFiles.slice(0, expectedCount) }
  }
  throw new Error(`No figure image folder under ${rootDirectory} contains exactly ${expectedCount} images.`)
}

const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'))
const firstIndexByName = new Map()
seed.forEach(([name], index) => { if (!firstIndexByName.has(name)) firstIndexByName.set(name, index + 1) })

const dishes = [...firstIndexByName].map(([name, index]) => {
  const [, cuisine, method] = seed[index - 1]
  const ingredients = ingredientsFor(name, method)
  const nutrition = nutritionFor(ingredients)
  const taste = tastesFor(name, method)
  const tags = [cuisine, method, nutrition.protein >= 30 ? '高蛋白' : nutrition.fiber >= 5 ? '膳食纤维' : '家常好味']
  return { id: `figure-${String(index).padStart(3, '0')}`, name, cuisine, method, taste, ingredients, nutrition, tags, source: 'figure', image: '' }
})

const relations = []
for (let leftIndex = 0; leftIndex < dishes.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < dishes.length; rightIndex += 1) {
    const leftDish = dishes[leftIndex]
    const rightDish = dishes[rightIndex]
    const score = relationScore(leftDish, rightDish)
    const reason = relationReason(leftDish, rightDish)
    relations.push({ sourceId: leftDish.id, targetId: rightDish.id, score: Number(score.toFixed(5)), reason })
    relations.push({ sourceId: rightDish.id, targetId: leftDish.id, score: Number(score.toFixed(5)), reason })
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  sourceImageCount: seed.length,
  dishHash: Object.fromEntries(dishes.map((dish) => [dish.id, dish])),
  nameHash: Object.fromEntries(dishes.map((dish) => [dish.name, dish.id])),
  graphEdgeCount: relations.length,
}
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const { directory: selectedFigureDirectory, imageFiles } = await resolveFigureImageSourceDirectory(figureDirectory, seed.length)
console.log(`Using figure image source: ${selectedFigureDirectory}`)

const pool = new Pool({ connectionString: databaseUrl })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const dish of dishes) {
    await client.query(
      `INSERT INTO catalog.dishes (id, name, cuisine, method, taste, ingredients, nutrition, tags, source, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuisine = EXCLUDED.cuisine, method = EXCLUDED.method,
         taste = EXCLUDED.taste, ingredients = EXCLUDED.ingredients, nutrition = EXCLUDED.nutrition,
         tags = EXCLUDED.tags, source = EXCLUDED.source, updated_at = now()`,
      [dish.id, dish.name, dish.cuisine, dish.method, JSON.stringify(dish.taste), JSON.stringify(dish.ingredients), JSON.stringify(dish.nutrition), JSON.stringify(dish.tags), dish.source],
    )
  }
  await client.query('DELETE FROM catalog.dish_relations WHERE source_id = ANY($1::varchar[]) OR target_id = ANY($1::varchar[])', [dishes.map((dish) => dish.id)])
  for (const relation of relations) {
    await client.query(
      `INSERT INTO catalog.dish_relations (source_id, target_id, score, reason)
       VALUES ($1, $2, $3, $4) ON CONFLICT (source_id, target_id) DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
      [relation.sourceId, relation.targetId, relation.score, relation.reason],
    )
  }
  for (let index = 0; index < imageFiles.length; index += 1) {
    const [name] = seed[index]
    const targetId = `figure-${String(firstIndexByName.get(name)).padStart(3, '0')}`
    const result = await client.query(
      `UPDATE media.dish_images SET dish_id = $1
       WHERE metadata->>'collection' = 'figure' AND metadata->>'originalFileName' = $2 AND deleted_at IS NULL`,
      [targetId, imageFiles[index].fileName],
    )
    if (result.rowCount !== 1) throw new Error(`Expected one image row for ${imageFiles[index].fileName}, received ${result.rowCount}.`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}

console.log(`Catalog ready: ${dishes.length} unique dishes from ${seed.length} images, ${relations.length} directed relations.`)
