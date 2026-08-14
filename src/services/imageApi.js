const imageApiBaseUrl = import.meta.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'

async function fetchDishImageChunk(dishIds) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3500)
  try {
    const query = new URLSearchParams({ dishIds: dishIds.join(',') })
    const response = await fetch(`${imageApiBaseUrl}/api/images?${query}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Image API returned ${response.status}`)
    const payload = await response.json()
    return Object.fromEntries((payload.images || []).map((image) => [image.dishId, image]))
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchDishImages(dishIds) {
  const uniqueDishIds = [...new Set(dishIds)].filter(Boolean)
  if (!uniqueDishIds.length) return {}
  const chunks = []
  for (let index = 0; index < uniqueDishIds.length; index += 50) chunks.push(uniqueDishIds.slice(index, index + 50))
  const results = await Promise.allSettled(chunks.map(fetchDishImageChunk))
  return Object.assign({}, ...results.filter((result) => result.status === 'fulfilled').map((result) => result.value))
}
