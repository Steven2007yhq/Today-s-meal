const titleRenames = new Map([
  ['韩国麻药鸡蛋', '韩式酱汁溏心蛋'],
  ['尖叫牛蛙', '泡椒牛蛙'],
])

const excludedTitles = new Map([
  ['酸梅汤（半成品加工）', '与正式版“酸梅汤”重复，且标题含内部加工说明'],
])

const unsafeTitlePattern = /轰炸机|炸弹|麻药|毒品|测试|样例|示例|占位|未命名/
const latinOrDigitPattern = /[A-Za-z0-9]/
const alcoholicSpiritPattern = /伏特加|朗姆酒?|威士忌|金酒|杜松子酒|龙舌兰酒?|利口酒|力娇酒|百利甜酒?|咖啡酒|甜酒|白兰地|苦艾酒|君度|波旁/
const kitchenToolPattern = /蒸锅|炒锅|平底锅|汤锅|电饭锅|高压锅|砂锅|锅具|菜刀|水果刀|剪刀|砍刀|刀具|削皮刀|砧板|烤箱|空气炸锅|电饭煲|微波炉|厨具|工具|筷子|汤勺|漏勺|吧勺|勺子|量杯|玻璃杯|马克杯|高球杯|利口酒杯|海波杯|杯子|打火机|压汁器|研杵|温度计|容器|雪克|搅拌棒|吸管|厨房秤|过滤网|滤网|保鲜膜|锡纸|手套|模具|打蛋器|料理机|榨汁机/
const exactKitchenTools = new Set(['锅', '碗', '盘', '盘子', '盆', '盆子', '刀', '勺', '杯', '筷子'])

export function isLikelyKitchenTool(value) {
  const normalized = String(value || '').trim()
  return exactKitchenTools.has(normalized) || kitchenToolPattern.test(normalized)
}

export function normalizeImportedDish(dish) {
  const originalName = String(dish?.name || '').trim()
  const name = titleRenames.get(originalName) || originalName
  return {
    ...dish,
    name,
    aliases: Array.isArray(dish?.aliases) ? dish.aliases.filter((alias) => alias !== originalName) : [],
  }
}

export function catalogDishIssues(dish, { sourceText = '' } = {}) {
  const name = String(dish?.name || '').trim()
  const ingredientText = (dish?.ingredients || []).map((ingredient) => ingredient?.name || '').join(' ')
  const issues = []

  if (!name) issues.push('菜品名为空')
  if (excludedTitles.has(name)) issues.push(excludedTitles.get(name))
  if (latinOrDigitPattern.test(name)) issues.push('菜品名包含拉丁字母或阿拉伯数字')
  if (unsafeTitlePattern.test(name)) issues.push('菜品名包含不适合面向家庭用户展示的词语')
  if (dish?.dishType === '饮品' && alcoholicSpiritPattern.test(`${ingredientText} ${sourceText}`)) {
    issues.push('酒精鸡尾酒或含烈酒饮品不进入默认家庭菜品目录')
  }

  return [...new Set(issues)]
}

export function catalogQualityAudit(dishes) {
  return dishes
    .map((dish) => ({ name: dish.name, issues: catalogDishIssues(dish) }))
    .filter((entry) => entry.issues.length > 0)
}

export function catalogIngredientAudit(dishes) {
  return dishes.flatMap((dish) => (dish.ingredients || [])
    .filter((ingredient) => isLikelyKitchenTool(ingredient?.name))
    .map((ingredient) => ({ dish: dish.name, ingredient: ingredient.name, issue: '厨具或耗材被误识别为食材' })))
}

export function importedTitleChange(name) {
  const normalized = titleRenames.get(String(name || '').trim())
  return normalized ? { from: name, to: normalized } : null
}
