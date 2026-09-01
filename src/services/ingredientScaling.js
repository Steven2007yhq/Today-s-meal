const MINIMUM_SCALE = 0.1
const MAXIMUM_SCALE = 10

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundTo(value, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function roundKitchenGrams(value) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 10) return Math.max(0.5, Math.round(value * 2) / 2)
  if (value < 50) return Math.max(1, Math.round(value))
  return Math.max(5, Math.round(value / 5) * 5)
}

function normalizeAnchors(ingredients, anchors) {
  const byIngredientIndex = new Map()
  for (const candidate of Array.isArray(anchors) ? anchors : []) {
    const ingredientIndex = Number(candidate?.ingredientIndex)
    const ingredient = Number.isInteger(ingredientIndex) ? ingredients[ingredientIndex] : null
    const baseGrams = Number(ingredient?.grams)
    const requestedGrams = Number(candidate?.grams)
    if (!ingredient || !Number.isFinite(baseGrams) || baseGrams <= 0 || !Number.isFinite(requestedGrams) || requestedGrams <= 0) continue
    const requestedScale = requestedGrams / baseGrams
    const scale = clamp(requestedScale, MINIMUM_SCALE, MAXIMUM_SCALE)
    byIngredientIndex.set(ingredientIndex, {
      ingredientIndex,
      ingredientName: ingredient.name,
      baseGrams,
      requestedGrams,
      targetGrams: roundTo(baseGrams * scale),
      scale,
      constrained: scale !== requestedScale,
      minimumGrams: roundTo(baseGrams * MINIMUM_SCALE),
      maximumGrams: roundTo(baseGrams * MAXIMUM_SCALE),
    })
  }
  return [...byIngredientIndex.values()].sort((left, right) => left.ingredientIndex - right.ingredientIndex)
}

function fitRelativeScale(anchors) {
  if (!anchors.length) return null
  // Minimize Σ((observed - scale × base) / base)². Normalizing by each
  // ingredient's base grams prevents a 300 g main ingredient from drowning
  // out a deliberately entered 8 g seasoning, so the closed-form estimate is
  // the mean of the observed/base ratios.
  const scale = clamp(anchors.reduce((total, anchor) => total + anchor.scale, 0) / anchors.length, MINIMUM_SCALE, MAXIMUM_SCALE)
  const relativeErrors = anchors.map((anchor) => Math.abs(anchor.scale - scale) / Math.max(scale, 0.001))
  const meanErrorPercent = roundTo(relativeErrors.reduce((total, error) => total + error, 0) / relativeErrors.length * 100)
  const maximumErrorPercent = roundTo(Math.max(...relativeErrors) * 100)
  return {
    scale,
    meanErrorPercent,
    maximumErrorPercent,
    fitQuality: meanErrorPercent <= 5 ? '高' : meanErrorPercent <= 15 ? '中' : '低',
  }
}

export function scalePortionFromIngredients(portion, requestedAnchors) {
  const ingredients = Array.isArray(portion?.ingredients) ? portion.ingredients : []
  const anchors = normalizeAnchors(ingredients, requestedAnchors)
  const fit = fitRelativeScale(anchors)
  if (!fit) return portion

  const anchorByIndex = new Map(anchors.map((anchor) => [anchor.ingredientIndex, anchor]))
  const scale = fit.scale
  const scaledIngredients = ingredients.map((ingredient, currentIndex) => ({
    ...ingredient,
    grams: anchorByIndex.get(currentIndex)?.targetGrams ?? roundKitchenGrams(Number(ingredient.grams) * scale),
  }))
  const scaledNutrition = Object.fromEntries(Object.entries(portion.nutrition || {}).map(([key, value]) => {
    const numericValue = Number(value)
    return [key, Number.isFinite(numericValue) ? roundTo(numericValue * scale) : value]
  }))

  return {
    ...portion,
    multiplier: roundTo(Number(portion.multiplier || 1) * scale, 2),
    ingredients: scaledIngredients,
    nutrition: scaledNutrition,
    adjustment: {
      mode: anchors.length >= 2 ? 'regression' : 'single',
      anchors: anchors.map((anchor) => ({ ...anchor, scale: roundTo(anchor.scale, 3) })),
      anchorCount: anchors.length,
      ingredientIndex: anchors[0].ingredientIndex,
      ingredientName: anchors[0].ingredientName,
      baseGrams: anchors[0].baseGrams,
      baseMultiplier: Number(portion.multiplier || 1),
      requestedGrams: anchors[0].requestedGrams,
      targetGrams: anchors[0].targetGrams,
      scale: roundTo(scale, 3),
      constrained: anchors.some((anchor) => anchor.constrained),
      meanErrorPercent: fit.meanErrorPercent,
      maximumErrorPercent: fit.maximumErrorPercent,
      fitQuality: fit.fitQuality,
      minimumGrams: anchors[0].minimumGrams,
      maximumGrams: anchors[0].maximumGrams,
    },
    reason: anchors.length >= 2
      ? `根据 ${anchors.length} 种已知食材做相对加权最小二乘拟合，剩余食材按 ${roundTo(scale, 2)}× 补齐；输入比例平均偏差 ${fit.meanErrorPercent}%（一致性${fit.fitQuality}）。`
      : `以${anchors[0].ingredientName} ${anchors[0].targetGrams}g 为基准，其他食材和营养按原配方比例同步换算（${roundTo(scale, 2)}×）。`,
  }
}

export function scalePortionFromIngredient(portion, ingredientIndex, requestedGrams) {
  return scalePortionFromIngredients(portion, [{ ingredientIndex, grams: requestedGrams }])
}
