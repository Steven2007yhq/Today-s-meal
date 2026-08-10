import { seasonalDishData } from './seasonalDishData.mjs'

const seasonalImages = import.meta.glob('../assets/dishes/seasonal/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })

function resolveSeasonalImage(imageFile) {
  return seasonalImages[`../assets/dishes/seasonal/${imageFile}`] || ''
}

export const seasonalDishes = seasonalDishData.map((dish) => ({
  ...dish,
  image: resolveSeasonalImage(dish.imageFile),
}))

export const seasonalDishById = new Map(seasonalDishes.map((dish) => [dish.id, dish]))
export const seasonalDishByName = new Map(seasonalDishes.map((dish) => [dish.name, dish]))
