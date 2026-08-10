import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFavoriteCollection, loadFavoriteState, removeFavoriteDish, saveFavoriteDish } from '../services/favoritesApi'
import { fetchDishImages } from '../services/imageApi'
import { getFavoriteActiveCollectionId, setFavoriteActiveCollectionId } from '../services/session'

function pickActiveCollectionId(collections, preferredId) {
  if (preferredId && collections.some((collection) => collection.id === preferredId)) return preferredId
  return collections.find((collection) => collection.isDefault)?.id || collections[0]?.id || ''
}

export function useFavoriteCatalog() {
  const [collections, setCollections] = useState([])
  const [favorites, setFavorites] = useState([])
  const [favoriteImages, setFavoriteImages] = useState({})
  const [activeCollectionId, setActiveCollectionIdState] = useState(getFavoriteActiveCollectionId())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('server')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await loadFavoriteState()
      const nextCollections = payload.collections || []
      const nextActiveCollectionId = pickActiveCollectionId(nextCollections, getFavoriteActiveCollectionId() || payload.activeCollectionId)
      if (nextActiveCollectionId) setFavoriteActiveCollectionId(nextActiveCollectionId)
      setCollections(nextCollections)
      setFavorites(payload.favorites || [])
      setActiveCollectionIdState(nextActiveCollectionId)
      setSource(payload.source || 'server')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '收藏加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadInitial() {
      await reload()
      if (!active) return
    }
    loadInitial()
    return () => {
      active = false
    }
  }, [reload])

  useEffect(() => {
    let active = true
    const favoriteDishIds = favorites.map((favorite) => favorite.dishId).filter(Boolean)
    if (!favoriteDishIds.length) {
      setFavoriteImages({})
      return undefined
    }
    fetchDishImages(favoriteDishIds)
      .then((images) => { if (active) setFavoriteImages(images) })
      .catch(() => { if (active) setFavoriteImages({}) })
    return () => {
      active = false
    }
  }, [favorites])

  const favoriteByDishId = useMemo(() => new Map(favorites.map((favorite) => [favorite.dishId, favorite])), [favorites])
  const favoriteDishIds = useMemo(() => new Set(favoriteByDishId.keys()), [favoriteByDishId])
  const collectionById = useMemo(() => new Map(collections.map((collection) => [collection.id, collection])), [collections])
  const activeCollection = collectionById.get(activeCollectionId) || collections.find((collection) => collection.isDefault) || collections[0] || null

  function setActiveCollectionId(collectionId) {
    const nextCollectionId = pickActiveCollectionId(collections, collectionId)
    setActiveCollectionIdState(nextCollectionId)
    setFavoriteActiveCollectionId(nextCollectionId)
  }

  async function toggleFavorite(dish) {
    if (!dish?.id) return { action: 'none' }
    if (favoriteByDishId.has(dish.id)) {
      await removeFavoriteDish(dish.id)
      await reload()
      return { action: 'removed', collection: favoriteByDishId.get(dish.id)?.collectionName || '收藏夹' }
    }
    const targetCollectionId = activeCollectionId || activeCollection?.id || ''
    await saveFavoriteDish({ dishId: dish.id, collectionId: targetCollectionId })
    await reload()
    return { action: 'added', collection: activeCollection?.name || '默认收藏' }
  }

  async function removeFavorite(dishId) {
    await removeFavoriteDish(dishId)
    await reload()
  }

  async function addCollection(name) {
    const collection = await createFavoriteCollection(name)
    if (collection?.id) {
      setFavoriteActiveCollectionId(collection.id)
      setActiveCollectionIdState(collection.id)
    }
    await reload()
    return collection
  }

  return {
    collections,
    favorites,
    favoriteImages,
    favoriteByDishId,
    favoriteDishIds,
    activeCollectionId,
    activeCollection,
    loading,
    error,
    source,
    reload,
    setActiveCollectionId,
    toggleFavorite,
    removeFavorite,
    addCollection,
  }
}

