import { createDishImageMatcher } from '../../shared/dish-image-matcher.mjs'

function fallbackCacheKey(dish) {
  const ingredientNames = Array.isArray(dish?.ingredients)
    ? dish.ingredients.slice(0, 3).map((item) => typeof item === 'string' ? item : item?.name)
    : []
  return JSON.stringify([
    dish?.id || '',
    dish?.name || '',
    dish?.dishType || dish?.dish_type || '',
    dish?.method || '',
    ingredientNames,
  ])
}

export function createLocalDishImageResolver(dishes) {
  const candidates = (dishes || []).filter((dish) => dish?.image)
  const findImageMatch = createDishImageMatcher(candidates)
  const resolvedByDish = new Map()

  return function resolveLocalDishImage(dish) {
    if (!dish || dish.image) return null
    const cacheKey = fallbackCacheKey(dish)
    if (resolvedByDish.has(cacheKey)) return resolvedByDish.get(cacheKey)

    const match = findImageMatch(dish)
    const result = match ? {
      url: match.candidate.image,
      thumbnailUrl: match.candidate.image,
      reused: true,
      source: 'local',
      sourceDishId: match.candidate.id,
      sourceDishName: match.candidate.name,
      matchReason: match.reason,
      matchScore: match.score,
    } : null
    resolvedByDish.set(cacheKey, result)
    return result
  }
}
