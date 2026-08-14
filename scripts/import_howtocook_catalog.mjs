import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const sourceRoot = path.resolve(process.argv[2] || process.env.HOWTOCOOK_SOURCE || '')
const outputPath = path.resolve(process.argv[3] || 'database/seeds/howtocook-recipes.json')
if (!process.argv[2] && !process.env.HOWTOCOOK_SOURCE) {
  throw new Error('请传入 HowToCook 仓库路径，或设置 HOWTOCOOK_SOURCE。')
}

const categoryMeta = {
  meat_dish: ['热菜', ['午餐', '晚餐']],
  vegetable_dish: ['素菜', ['午餐', '晚餐']],
  staple: ['主食', ['早餐', '午餐', '晚餐']],
  aquatic: ['水产', ['午餐', '晚餐']],
  breakfast: ['早餐', ['早餐']],
  drink: ['饮品', ['早餐', '加餐']],
  soup: ['汤羹', ['午餐', '晚餐']],
  dessert: ['甜品', ['加餐']],
  'semi-finished': ['半成品', ['午餐', '晚餐']],
  condiment: ['调味品', ['午餐', '晚餐']],
}

const regionKeywords = [
  '北京', '天津', '上海', '重庆', '河北', '河南', '山东', '山西', '陕西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '湖北', '湖南', '广东', '广西', '海南', '四川', '贵州', '云南',
  '西藏', '甘肃', '青海', '宁夏', '新疆', '内蒙古', '香港', '澳门', '台湾', '东北', '江南', '全国',
]
const methodKeywords = ['清蒸', '红烧', '爆炒', '小炒', '滑炒', '炒', '炖', '煮', '煎', '炸', '烤', '焖', '卤', '拌', '蒸', '熬', '烩']
const toolWords = /锅|碗|盘|盆|刀|砧板|烤箱|空气炸锅|电饭煲|厨具|工具|筷子|勺|杯$/
const seasoningWords = /盐|糖|酱油|生抽|老抽|醋|味精|鸡精|胡椒|十三香|料酒|食用油|淀粉|孜然|蚝油|豆瓣酱|葱|姜|蒜|辣椒|花椒|桂皮|八角|芝麻|香料/

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
  }
  return files
}

function cleanName(value) {
  return String(value || '').replace(/^#+\s*/, '').replace(/的做法\s*$/, '').replace(/做法\s*$/, '').trim()
}

function sectionOf(markdown, heading) {
  const headingMatch = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(markdown)
  if (!headingMatch) return ''
  const remainder = markdown.slice(headingMatch.index + headingMatch[0].length)
  const nextHeadingIndex = remainder.search(/^##\s+/m)
  return nextHeadingIndex >= 0 ? remainder.slice(0, nextHeadingIndex) : remainder
}

function ingredientNames(markdown) {
  const section = sectionOf(markdown, '必备原料和工具')
  const names = []
  for (const line of section.split(/\r?\n/)) {
    if (!/^\s*[-*+]\s+/.test(line)) continue
    const raw = line.replace(/^\s*[-*+]\s+/, '').replace(/\([^)]*\)|（[^）]*）/g, '')
    for (const part of raw.split(/[、，,；;\/]/)) {
      const value = part.replace(/^[^：:]+[：:]/, '').replace(/\d+(?:\.\d+)?\s*(?:克|g|kg|千克|毫升|ml|个|只|根|片|勺).*$/i, '').trim()
      if (!value || value.length > 20 || toolWords.test(value)) continue
      names.push(value)
    }
  }
  return [...new Set(names)].slice(0, 12)
}

function defaultGrams(name) {
  if (seasoningWords.test(name)) return /食用油/.test(name) ? 10 : 5
  if (/肉|鸡|鸭|鱼|虾|蟹|贝|鱿|蛋|豆腐/.test(name)) return 160
  if (/米|面|粉|饭|馍|饼|粥/.test(name)) return 180
  return 100
}

function ingredientsOf(markdown) {
  const calculation = sectionOf(markdown, '计算')
  return ingredientNames(markdown).map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = calculation.match(new RegExp(`${escaped}.{0,20}?(\\d+(?:\\.\\d+)?)\\s*(kg|千克|g|克|ml|毫升)`, 'i'))
    let grams = match ? Number(match[1]) : defaultGrams(name)
    if (match && /kg|千克/i.test(match[2])) grams *= 1_000
    return { name, grams: Math.max(1, Math.min(2_000, Math.round(grams))), original: name }
  })
}

function inferMethod(name, markdown) {
  return methodKeywords.find((method) => name.includes(method))
    || methodKeywords.find((method) => sectionOf(markdown, '操作').includes(method))
    || '家常烹饪'
}

function inferRegions(markdown) {
  const introduction = markdown.split(/^##\s+/m)[0]
  const regions = regionKeywords.filter((region) => introduction.includes(region))
  return regions.length ? regions.slice(0, 3) : ['全国']
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 20)
}

async function gitRevision(repositoryPath) {
  const gitDirectory = path.join(repositoryPath, '.git')
  const head = (await fs.readFile(path.join(gitDirectory, 'HEAD'), 'utf8').catch(() => '')).trim()
  if (/^[a-f0-9]{40}$/i.test(head)) return head
  const ref = head.replace(/^ref:\s*/, '')
  if (ref) {
    const looseRef = (await fs.readFile(path.join(gitDirectory, ...ref.split('/')), 'utf8').catch(() => '')).trim()
    if (looseRef) return looseRef
  }
  return process.env.HOWTOCOOK_REVISION || 'unknown'
}

const commit = await gitRevision(sourceRoot)
const dishesRoot = path.join(sourceRoot, 'dishes')
const files = (await walk(dishesRoot)).sort((left, right) => left.localeCompare(right, 'zh-CN'))
const dishes = []
for (const filePath of files) {
  const relativePath = path.relative(dishesRoot, filePath).replaceAll('\\', '/')
  const category = relativePath.split('/')[0]
  if (category === 'template') continue
  const markdown = await fs.readFile(filePath, 'utf8')
  const name = cleanName(markdown.match(/^#\s+(.+)$/m)?.[1])
  const ingredients = ingredientsOf(markdown)
  if (!name || ingredients.length < 2) continue
  const [dishType, mealTypes] = categoryMeta[category] || ['其他', ['午餐', '晚餐']]
  dishes.push({
    id: `howtocook-${sha(name)}`,
    name,
    aliases: [],
    cuisine: '开源家常菜',
    regions: inferRegions(markdown),
    dishType,
    mealTypes,
    method: inferMethod(name, markdown),
    taste: ['家常鲜香'],
    ingredients,
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
    tags: [dishType, '开源配方', '营养待核验'],
    source: 'howtocook',
    sourceUrl: `https://github.com/Anduin2017/HowToCook/blob/${commit}/${encodeURI(`dishes/${relativePath}`)}`,
    licenseType: 'Unlicense',
    evidenceLevel: 'B',
    reviewStatus: 'candidate',
    nutritionConfidence: 'unverified',
    publicationStatus: 'published',
    sourceRevision: commit,
  })
}

const unique = [...new Map(dishes.map((dish) => [dish.name.normalize('NFKC'), dish])).values()]
await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'https://github.com/Anduin2017/HowToCook',
  license: 'Unlicense',
  sourceRevision: commit,
  recipeCount: unique.length,
  dishes: unique,
}, null, 2)}\n`, 'utf8')
console.log(`HowToCook catalog: ${unique.length} recipes -> ${outputPath}`)
