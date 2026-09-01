const pantryPattern = /^(食用油|植物油|橄榄油|芝麻油|香油|生姜|姜|小葱|葱|葱花|香菜|食盐|盐|酱油|生抽|老抽|蚝油|白糖|糖|冰糖|淀粉|大蒜|蒜|料酒|香醋|白醋|米醋|醋|胡椒|黑胡椒|花椒|辣椒|干辣椒|小米辣|豆瓣酱|味精|鸡精|水|高汤)$/

const formRules = [
  ['粥品', /粥/],
  ['饺子', /饺子|水饺|蒸饺|煎饺|虾饺|锅贴/],
  ['馄饨', /馄饨|云吞|抄手/],
  ['烧卖', /烧卖|烧麦/],
  ['杂粮包点', /全麦.*包子|杂粮.*包子|荞麦.*包子/],
  ['包子', /包子|小笼包|灌汤包|生煎/],
  ['馒头', /馒头/],
  ['包点', /包子|小笼包|灌汤包|烧卖|馒头|生煎/],
  ['刀削面', /刀削面/],
  ['米线', /米线/],
  ['河粉', /河粉/],
  ['米粉', /米粉/],
  ['汤面', /汤面/],
  ['拌面', /拌面|凉面/],
  ['炒面', /炒面/],
  ['面食', /意大利面|通心粉|刀削面|拉面|拌面|炒面|汤面|面条|米线|河粉|米粉|螺蛳粉|凉皮|凉粉/],
  ['炒饭', /炒饭/],
  ['煲仔饭', /煲仔饭/],
  ['烩饭', /烩饭/],
  ['焖饭', /焖饭/],
  ['盖饭', /盖饭/],
  ['饭团', /饭团/],
  ['米饭', /饭/],
  ['饼类', /馅饼|烤饼|薄饼|煎饼|鸡蛋饼|葱油饼/],
  ['汤羹', /汤|羹|佛跳墙/],
  ['火锅', /火锅|锅物|麻辣烫|麻辣香锅/],
  ['丸子', /丸子|肉丸|狮子头|肉圆/],
  ['肉饼', /肉饼|肉末饼/],
  ['卷类', /春卷|鸡肉卷|豆皮卷|响铃/],
  ['粽子', /粽子|肉粽|蜜枣粽|豆沙粽/],
  ['披萨', /披萨/],
  ['沙拉', /沙拉/],
  ['凉菜', /凉拌|冷盘|白切|手撕鸡|口水鸡|冷吃|捞鸡|夫妻肺片|皮蛋豆腐/],
  ['饮品', /饮品|果茶|果昔|奶昔|豆浆|酸梅汤|果汁|茶饮/],
  ['奶制甜品', /双皮奶|姜撞奶|布丁/],
  ['糯米点心', /汤圆|冬至团|青团|年糕/],
  ['糖水糊', /甜汤|糖水|红豆沙|绿豆沙|芝麻糊/],
  ['拔丝甜品', /拔丝/],
  ['烘焙甜点', /蛋糕|面包|提拉米苏|月饼|巧果|苹果派/],
]

const ingredientFamilyRules = [
  ['排骨', /排骨/], ['猪内脏', /猪肝|猪肚|猪心|猪腰|猪肠|大肠|猪耳|猪舌/], ['猪肉', /猪|咸肉|五花肉|里脊|肉末|肉丝|肉片|肉馅|叉烧|培根|火腿|香肠|大肠|猪蹄|猪耳/],
  ['牛内脏', /牛肚|牛百叶|牛舌|牛心|牛肝|牛腰/], ['牛肉', /牛肉|牛腩|牛排|牛柳|牛腱|牛肚|牛舌/], ['羊肉', /羊肉|羊排|羊腿/],
  ['鸡内脏', /鸡胗|鸡肝|鸡心|鸡杂/], ['鸡翅', /鸡翅/], ['鸡肉', /(?<!素)鸡(?!蛋)|鸡肉|鸡胸|鸡丁|鸡块|鸡腿|鸡翅|整鸡|三黄鸡/], ['鸭内脏', /鸭胗|鸭肝|鸭心|鸭杂/], ['鸭肉', /鸭肉|鸭胸|鸭腿|盐水鸭/], ['兔肉', /兔/],
  ['水产', /鱼|鳕鱼|三文鱼|鳝鱼|虾|蟹|蛤|蚌|螺|鲍鱼|扇贝|鱿鱼|海参|海蜇/],
  ['鱼类', /鱼|鳕鱼|三文鱼|鳝/], ['虾类', /虾/], ['蟹类', /蟹/], ['贝类', /蛤|蚌|螺|鲍鱼|扇贝/], ['鱿鱼', /鱿鱼/],
  ['鸡蛋', /鸡蛋|蛋清|蛋黄|炒蛋|蒸蛋/], ['豆腐', /豆腐|豆干|香干|腐竹|豆皮|干豆腐|素鸡/],
  ['番茄', /番茄|西红柿/], ['土豆', /土豆|马铃薯|洋芋/], ['红薯', /红薯|地瓜/], ['茄子', /茄子/],
  ['白菜', /白菜|娃娃菜/], ['叶菜', /青菜|小白菜|生菜|菠菜|油菜|油麦菜|空心菜|茼蒿/],
  ['辣椒', /青椒|尖椒|彩椒|甜椒|辣椒/], ['菌菇', /香菇|平菇|蘑菇|口蘑|金针菇|杏鲍菇|榛蘑/], ['木耳', /木耳/],
  ['黄瓜', /黄瓜/], ['胡萝卜', /胡萝卜/], ['萝卜', /白萝卜|(?<!胡)萝卜/], ['冬瓜', /冬瓜/], ['南瓜', /南瓜/],
  ['豆角', /豆角|四季豆|豇豆|荷兰豆/], ['花菜', /花菜|西兰花|西蓝花/], ['芹菜', /芹菜|西芹/],
  ['山药', /山药/], ['莲藕', /莲藕|藕/], ['海带', /海带|紫菜/], ['玉米', /玉米/],
  ['米饭', /米饭|大米|香米|糙米|黑米|紫米|糯米/], ['面食', /面条|意大利面|通心粉|刀削面|拉面|米线|河粉|米粉|粉丝|粉条/],
  ['奶制品', /牛奶|奶油|芝士|奶酪|酸奶/], ['水果', /苹果|梨|香蕉|芒果|草莓|蓝莓|桃|橙|柚|菠萝|猕猴桃|火龙果|荔枝|龙眼|葡萄|西瓜|哈密瓜|木瓜|山楂|柿子/],
]

const methodRules = [
  ['炒制', /炒|爆|煸/], ['烧炖', /红烧|烧(?!烤)|焖|炖|煨|烩|煲/], ['蒸制', /蒸/], ['煮制', /煮|汆|白灼|水波/],
  ['炸制', /炸|熘/], ['煎制', /煎/], ['烤制', /烧烤|烤|烘/], ['卤制', /卤/], ['凉拌', /拌|冷藏/], ['调制', /冲泡|调制/],
]

const animalFamilies = new Set(['排骨', '猪内脏', '猪肉', '牛内脏', '牛肉', '羊肉', '鸡内脏', '鸡翅', '鸡肉', '鸭内脏', '鸭肉', '兔肉', '鱼类', '虾类', '蟹类', '贝类', '鱿鱼'])
const coarseForms = new Set(['汤羹', '火锅', '凉菜', '饮品'])

function normalized(value) {
  return String(value || '').normalize('NFKC').replace(/[\s·•、，,。()（）\-—_]/g, '')
}

function arrayValue(value) {
  return Array.isArray(value) ? value : []
}

function ingredientNames(dish) {
  return arrayValue(dish?.ingredients)
    .map((item) => normalized(typeof item === 'string' ? item : item?.name))
    .filter((name) => name && !pantryPattern.test(name))
    .slice(0, 2)
}

function matchingLabels(text, rules) {
  const value = normalized(text)
  return new Set(rules.filter(([, pattern]) => pattern.test(value)).map(([label]) => label))
}

function dishForms(dish) {
  const forms = matchingLabels(`${dish?.name || ''}${dish?.dish_type || dish?.dishType || ''}`, formRules)
  if (!forms.size && /汤羹|粥品|饮品|甜品|凉菜/.test(dish?.dish_type || dish?.dishType || '')) {
    forms.add(dish.dish_type || dish.dishType)
  }
  return forms
}

function ingredientFamilies(dish) {
  return matchingLabels(`${dish?.name || ''}${ingredientNames(dish).join('')}`, ingredientFamilyRules)
}

function methodFamilies(dish) {
  return matchingLabels(dish?.method, methodRules)
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value))
}

function describeDish(dish) {
  return {
    dish,
    ingredients: new Set(ingredientNames(dish)),
    families: ingredientFamilies(dish),
    forms: dishForms(dish),
    methods: methodFamilies(dish),
    tastes: new Set(arrayValue(dish?.taste)),
  }
}

function imageMatchScore(dishProfile, candidateProfile) {
  const { dish } = dishProfile
  const candidate = candidateProfile.dish
  const sharedIngredients = intersection(dishProfile.ingredients, candidateProfile.ingredients)
  const sharedFamilies = intersection(dishProfile.families, candidateProfile.families)
  const sharedForms = intersection(dishProfile.forms, candidateProfile.forms)
  const sharedMethods = intersection(dishProfile.methods, candidateProfile.methods)
  const sharedTastes = intersection(dishProfile.tastes, candidateProfile.tastes)

  let score = sharedIngredients.length * 7 + sharedFamilies.length * 5 + sharedForms.length * 7 + sharedMethods.length * 2.5
  if (dish?.method && dish.method === candidate?.method) score += 2
  if ((dish?.dish_type || dish?.dishType) && (dish?.dish_type || dish?.dishType) === (candidate?.dish_type || candidate?.dishType)) score += 1.5
  if (dish?.cuisine && dish.cuisine === candidate?.cuisine) score += 0.75
  if (sharedTastes.length) score += 0.75

  if (dishProfile.forms.size && candidateProfile.forms.size && !sharedForms.length) score -= 9
  if (dishProfile.forms.size && !candidateProfile.forms.size) score -= 7
  if (!dishProfile.forms.size && candidateProfile.forms.size) score -= 7

  const dishAnimals = new Set([...dishProfile.families].filter((value) => animalFamilies.has(value)))
  const candidateAnimals = new Set([...candidateProfile.families].filter((value) => animalFamilies.has(value)))
  const animalConflict = dishAnimals.size !== candidateAnimals.size
    || [...dishAnimals].some((value) => !candidateAnimals.has(value))
  const formConflict = dishProfile.forms.size !== candidateProfile.forms.size
    || [...dishProfile.forms].some((value) => !candidateProfile.forms.has(value))
  const methodConflict = dishProfile.methods.size > 0
    && candidateProfile.methods.size > 0
    && !sharedMethods.length
  const coarseFormOnly = sharedForms.length > 0
    && sharedForms.every((value) => coarseForms.has(value))
    && sharedIngredients.length === 0
    && sharedFamilies.length === 0
  if (dishAnimals.size && !intersection(dishAnimals, candidateAnimals).length) {
    score -= sharedForms.length ? (candidateAnimals.size ? 8 : 4) : (candidateAnimals.size ? 10 : 8)
  }

  const eligible = !animalConflict
    && !formConflict
    && !methodConflict
    && !coarseFormOnly
    && (sharedIngredients.length > 0 || sharedFamilies.length > 0 || sharedForms.length > 0)
  return { score, eligible, sharedIngredients, sharedFamilies, sharedForms, sharedMethods }
}

function matchReason(match) {
  const family = match.sharedFamilies.find((value) => value !== '水产') || match.sharedFamilies[0]
  if (match.sharedForms.length && match.sharedIngredients.length) return `同为${match.sharedForms[0]}，共用${match.sharedIngredients[0]}`
  if (match.sharedForms.length && family) return `同为${match.sharedForms[0]}，主料同属${family}`
  if (match.sharedIngredients.length) return `共用主料${match.sharedIngredients[0]}`
  if (family) return `主料同属${family}`
  if (match.sharedForms.length) return `同为${match.sharedForms[0]}`
  return '菜品形态相近'
}

function findBestMatch(dish, candidateProfiles, minimumScore) {
  const dishProfile = describeDish(dish)
  const ranked = candidateProfiles
    .map((candidateProfile) => ({ candidate: candidateProfile.dish, ...imageMatchScore(dishProfile, candidateProfile) }))
    .filter((match) => match.eligible && match.score >= minimumScore)
    .sort((left, right) => right.score - left.score
      || String(left.candidate?.name || '').localeCompare(String(right.candidate?.name || ''), 'zh-CN'))
  if (!ranked.length) return null
  const best = ranked[0]
  return { candidate: best.candidate, score: Number(best.score.toFixed(2)), reason: matchReason(best) }
}

export function createDishImageMatcher(candidates, { minimumScore = 6 } = {}) {
  const candidateProfiles = (candidates || []).filter(Boolean).map(describeDish)
  return (dish) => findBestMatch(dish, candidateProfiles, minimumScore)
}

export function findSimilarDishImage(dish, candidates, options = {}) {
  return createDishImageMatcher(candidates, options)(dish)
}
