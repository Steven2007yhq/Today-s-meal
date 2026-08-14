export const STORAGE_KEYS = Object.freeze({
  account: 'mealDemoAccount',
  authSession: 'mealAuthSession',
  calendarMeals: 'calendarMealsByDate',
  favoriteActiveCollection: 'mealFavoriteActiveCollectionId',
  favorites: 'mealFavoritesLocalStore',
  familyProfile: 'mealFamilyProfile',
  elderProfile: 'mealElderProfile',
  fitnessTrainingPlan: 'fitnessTrainingPlan',
  mealHistory: 'mealHistory',
  notificationReadIds: 'mealReadNotificationIds',
  ownerKey: 'mealOwnerKey',
})

function resolveStorage(storage) {
  if (storage) return storage
  try {
    return globalThis.window?.localStorage || null
  } catch {
    return null
  }
}

export function readStorageValue(key, fallback = '', storage) {
  try {
    return resolveStorage(storage)?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorageValue(key, value, storage) {
  try {
    const target = resolveStorage(storage)
    if (!target) return false
    target.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export function removeStorageValue(key, storage) {
  try {
    const target = resolveStorage(storage)
    if (!target) return false
    target.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function readJsonStorage(key, fallback = null, validate = () => true, storage) {
  const rawValue = readStorageValue(key, '', storage)
  if (!rawValue) return fallback
  try {
    const value = JSON.parse(rawValue)
    return validate(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writeJsonStorage(key, value, storage) {
  try {
    return writeStorageValue(key, JSON.stringify(value), storage)
  } catch {
    return false
  }
}
