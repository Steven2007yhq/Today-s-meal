const catalogApiBaseUrl = import.meta.env.VITE_CATALOG_API_URL || import.meta.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'

async function catalogRequest(path, signal) {
  const controller = signal ? null : new AbortController()
  const requestSignal = signal || controller.signal
  const timeout = controller ? window.setTimeout(() => controller.abort(), 5_000) : null
  try {
    const response = await fetch(`${catalogApiBaseUrl}${path}`, { signal: requestSignal })
    if (!response.ok) throw new Error(`Catalog API returned ${response.status}`)
    return await response.json()
  } finally {
    if (timeout) window.clearTimeout(timeout)
  }
}

export function listCatalogDishes({ query = '', cuisine = 'all', region = 'all', dishType = 'all', page = 1, limit = 36 } = {}, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (query.trim()) params.set('q', query.trim())
  if (cuisine !== 'all') params.set('cuisine', cuisine)
  if (region !== 'all') params.set('region', region)
  if (dishType !== 'all') params.set('dishType', dishType)
  return catalogRequest(`/api/catalog/dishes?${params}`, signal)
}

export function readCatalogFacets(signal) {
  return catalogRequest('/api/catalog/facets', signal)
}

export function readCatalogRelations(dishId, limit = 6, signal) {
  return catalogRequest(`/api/catalog/dishes/${encodeURIComponent(dishId)}/relations?limit=${limit}`, signal)
}
