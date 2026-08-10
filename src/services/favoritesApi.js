import { dishById } from '../data/dishLibrary'
import { getFavoriteActiveCollectionId, getOrCreateMealOwnerKey, readAuthSession, setFavoriteActiveCollectionId } from './session'

const favoriteApiBaseUrl = import.meta.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'
const localFavoritesStorageKey = 'mealFavoritesLocalStore'
const defaultCollectionName = '默认收藏'
const defaultCollectionColor = '#e96f45'

function ownerKeyHash(ownerKey) {
  return ownerKey
}

function currentOwnerKey() {
  return readAuthSession()?.user?.id || getOrCreateMealOwnerKey()
}

function readLocalStore() {
  try {
    const payload = JSON.parse(window.localStorage.getItem(localFavoritesStorageKey))
    return payload && typeof payload === 'object' ? payload : {}
  } catch {
    return {}
  }
}

function writeLocalStore(store) {
  window.localStorage.setItem(localFavoritesStorageKey, JSON.stringify(store))
}

function buildFallbackFavoriteCollection(ownerKey) {
  return {
    id: `local-default-${ownerKey}`,
    ownerKeyHash: ownerKeyHash(ownerKey),
    name: defaultCollectionName,
    color: defaultCollectionColor,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function normalizeLocalState(ownerKey, store) {
  const ownerStore = store[ownerKey] && typeof store[ownerKey] === 'object' ? store[ownerKey] : {}
  const collections = Array.isArray(ownerStore.collections) ? ownerStore.collections.slice() : []
  if (!collections.some((collection) => collection.isDefault)) {
    collections.unshift(buildFallbackFavoriteCollection(ownerKey))
  }
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]))
  const favorites = Array.isArray(ownerStore.favorites) ? ownerStore.favorites.map((item) => {
    const dish = dishById.get(item.dishId)
    const collection = collectionById.get(item.collectionId) || collections[0]
    return {
      ...item,
      collectionId: collection?.id || item.collectionId,
      collectionName: collection?.name || item.collectionName || defaultCollectionName,
      collectionColor: collection?.color || item.collectionColor || defaultCollectionColor,
      isDefaultCollection: Boolean(collection?.isDefault),
      name: dish?.name || item.name || '未知菜品',
      cuisine: dish?.cuisine || item.cuisine || '家常菜',
      method: dish?.method || item.method || '家常做法',
      taste: dish?.taste || item.taste || [],
      ingredients: dish?.ingredients || item.ingredients || [],
      nutrition: dish?.nutrition || item.nutrition || {},
      tags: dish?.tags || item.tags || [],
      image: dish?.image || item.image || '',
      source: dish?.source || item.source || 'local',
    }
  }) : []
  const favoriteCountByCollection = new Map()
  for (const favorite of favorites) {
    favoriteCountByCollection.set(favorite.collectionId, (favoriteCountByCollection.get(favorite.collectionId) || 0) + 1)
  }
  const normalizedCollections = collections.map((collection) => ({
    ...collection,
    dishCount: favoriteCountByCollection.get(collection.id) || 0,
  }))
  const activeCollectionId = getFavoriteActiveCollectionId() || normalizedCollections[0]?.id || ''
  return {
    ownerKey,
    collections: normalizedCollections,
    favorites,
    activeCollectionId,
    source: 'local',
  }
}

function ensureLocalOwnerStore(ownerKey) {
  const store = readLocalStore()
  const state = normalizeLocalState(ownerKey, store)
  store[ownerKey] = {
    collections: state.collections,
    favorites: state.favorites.map((item) => ({
      id: item.id,
      dishId: item.dishId,
      collectionId: item.collectionId,
      collectionName: item.collectionName,
      collectionColor: item.collectionColor,
      note: item.note || '',
      sortOrder: item.sortOrder || 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    })),
  }
  writeLocalStore(store)
  return state
}

function createAbortController(timeoutMs = 3000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeout }
}

async function requestFavoriteJson(pathname, options = {}) {
  const { controller, timeout } = createAbortController(options.timeoutMs || 2600)
  try {
    const response = await fetch(`${favoriteApiBaseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Meal-Owner-Key': currentOwnerKey(),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || `Favorite API returned ${response.status}`)
    }
    if (response.status === 204) return null
    return await response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

function normalizeRemoteState(payload, ownerKey) {
  const collections = Array.isArray(payload?.collections) ? payload.collections : []
  const favorites = Array.isArray(payload?.favorites) ? payload.favorites : []
  const activeCollectionId = payload?.activeCollectionId || getFavoriteActiveCollectionId() || collections.find((collection) => collection.isDefault)?.id || collections[0]?.id || ''
  if (activeCollectionId) setFavoriteActiveCollectionId(activeCollectionId)
  return {
    ownerKey,
    collections,
    favorites,
    activeCollectionId,
    source: 'server',
  }
}

export async function loadFavoriteState() {
  const ownerKey = currentOwnerKey()
  try {
    const payload = await requestFavoriteJson('/api/favorites', { timeoutMs: 2200 })
    return normalizeRemoteState(payload, ownerKey)
  } catch {
    return ensureLocalOwnerStore(ownerKey)
  }
}

export async function createFavoriteCollection(name, color = defaultCollectionColor) {
  const trimmedName = String(name || '').trim().slice(0, 60)
  if (!trimmedName) throw new Error('收藏夹名字不能为空')
  try {
    const payload = await requestFavoriteJson('/api/favorites/collections', {
      method: 'POST',
      body: { name: trimmedName, color },
      timeoutMs: 2400,
    })
    if (payload?.collection?.id) setFavoriteActiveCollectionId(payload.collection.id)
    return payload?.collection || null
  } catch {
    const ownerKey = currentOwnerKey()
    const store = readLocalStore()
    const state = normalizeLocalState(ownerKey, store)
    const existing = state.collections.find((collection) => collection.name === trimmedName)
    if (existing) {
      setFavoriteActiveCollectionId(existing.id)
      return existing
    }
    const collection = {
      id: `local-${ownerKey}-${Date.now()}`,
      ownerKeyHash: ownerKeyHash(ownerKey),
      name: trimmedName,
      color,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store[ownerKey] = {
      collections: [...state.collections, collection],
      favorites: state.favorites.map((item) => ({
        id: item.id,
        dishId: item.dishId,
        collectionId: item.collectionId,
        collectionName: item.collectionName,
        collectionColor: item.collectionColor,
        note: item.note || '',
        sortOrder: item.sortOrder || 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    }
    writeLocalStore(store)
    setFavoriteActiveCollectionId(collection.id)
    return collection
  }
}

export async function saveFavoriteDish({ dishId, collectionId = '', note = '' }) {
  const resolvedDishId = String(dishId || '').trim()
  if (!resolvedDishId) throw new Error('菜品 ID 不能为空')
  const resolvedCollectionId = collectionId || getFavoriteActiveCollectionId()
  try {
    const payload = await requestFavoriteJson('/api/favorites', {
      method: 'POST',
      body: { dishId: resolvedDishId, collectionId: resolvedCollectionId, note },
      timeoutMs: 2400,
    })
    return payload?.favorite || null
  } catch {
    const ownerKey = currentOwnerKey()
    const store = readLocalStore()
    const state = normalizeLocalState(ownerKey, store)
    const existing = state.favorites.find((item) => item.dishId === resolvedDishId)
    const collection = state.collections.find((item) => item.id === resolvedCollectionId) || state.collections.find((item) => item.isDefault) || state.collections[0]
    const dish = dishById.get(resolvedDishId)
    const favorite = {
      id: existing?.id || `local-fav-${resolvedDishId}`,
      dishId: resolvedDishId,
      collectionId: collection?.id || state.collections[0]?.id || '',
      collectionName: collection?.name || defaultCollectionName,
      collectionColor: collection?.color || defaultCollectionColor,
      note: String(note || '').slice(0, 160),
      sortOrder: existing?.sortOrder || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: dish?.name || resolvedDishId,
      cuisine: dish?.cuisine || '家常菜',
      method: dish?.method || '家常做法',
      taste: dish?.taste || [],
      ingredients: dish?.ingredients || [],
      nutrition: dish?.nutrition || {},
      tags: dish?.tags || [],
      image: dish?.image || '',
      source: dish?.source || 'local',
      isDefaultCollection: Boolean(collection?.isDefault),
    }
    store[ownerKey] = {
      collections: state.collections,
      favorites: existing
        ? state.favorites.map((item) => (item.dishId === resolvedDishId ? favorite : item))
        : [...state.favorites, favorite],
    }
    writeLocalStore(store)
    return favorite
  }
}

export async function removeFavoriteDish(dishId) {
  const resolvedDishId = String(dishId || '').trim()
  if (!resolvedDishId) throw new Error('菜品 ID 不能为空')
  try {
    await requestFavoriteJson(`/api/favorites/${encodeURIComponent(resolvedDishId)}`, {
      method: 'DELETE',
      timeoutMs: 2400,
    })
  } catch {
    const ownerKey = currentOwnerKey()
    const store = readLocalStore()
    const state = normalizeLocalState(ownerKey, store)
    store[ownerKey] = {
      collections: state.collections,
      favorites: state.favorites.filter((item) => item.dishId !== resolvedDishId),
    }
    writeLocalStore(store)
  }
}
