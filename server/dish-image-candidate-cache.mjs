export function createDishImageCandidateCache({ loadCandidates, ttlMs = 60_000, now = Date.now }) {
  if (typeof loadCandidates !== 'function') throw new TypeError('loadCandidates must be a function')

  let cachedCandidates = null
  let validUntil = 0
  let pendingLoad = null
  let revision = 0

  async function read() {
    if (cachedCandidates && now() < validUntil) return cachedCandidates
    if (pendingLoad) return pendingLoad

    const loadRevision = revision
    const load = Promise.resolve()
      .then(loadCandidates)
      .then((candidates) => {
        const normalizedCandidates = Array.isArray(candidates) ? candidates : []
        if (loadRevision === revision) {
          cachedCandidates = normalizedCandidates
          validUntil = now() + Math.max(0, Number(ttlMs) || 0)
        }
        return normalizedCandidates
      })
      .catch((error) => {
        if (cachedCandidates) return cachedCandidates
        throw error
      })
      .finally(() => {
        if (pendingLoad === load) pendingLoad = null
      })

    pendingLoad = load
    return load
  }

  function invalidate() {
    revision += 1
    cachedCandidates = null
    validUntil = 0
    pendingLoad = null
  }

  return { read, invalidate }
}
