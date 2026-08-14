import {
  readJsonStorage,
  readStorageValue,
  removeStorageValue,
  STORAGE_KEYS,
  writeJsonStorage,
  writeStorageValue,
} from './browserStorage'

export function getOrCreateMealOwnerKey() {
  if (typeof window === 'undefined') return 'server-preview-owner'
  const existingKey = readStorageValue(STORAGE_KEYS.ownerKey)
  if (existingKey) return existingKey
  const generatedKey = window.crypto?.randomUUID?.() || `meal-${Date.now()}-${Math.random().toString(16).slice(2)}`
  writeStorageValue(STORAGE_KEYS.ownerKey, generatedKey)
  return generatedKey
}

export function normalizeDemoAccount(account) {
  if (!account || typeof account !== 'object') return null
  const ownerKey = getOrCreateMealOwnerKey()
  const nextAccount = { ...account }
  delete nextAccount.password
  delete nextAccount.confirmPassword
  if (!nextAccount.accountId) nextAccount.accountId = ownerKey
  if (!nextAccount.displayName) {
    if (nextAccount.loginType === 'phone' && nextAccount.phone) {
      nextAccount.displayName = `尾号${String(nextAccount.phone).slice(-4)}的饭友`
    } else if (nextAccount.loginType === 'email' && nextAccount.email) {
      nextAccount.displayName = nextAccount.email
    } else if (nextAccount.provider) {
      nextAccount.displayName = `${nextAccount.provider}饭友`
    } else {
      nextAccount.displayName = '小饭同学'
    }
  }
  return nextAccount
}

export function readAuthSession() {
  return readJsonStorage(STORAGE_KEYS.authSession, null)
}

export function getAuthToken() {
  return readAuthSession()?.session?.token || ''
}

export function saveAuthSession(payload) {
  if (!payload?.session?.token || !payload?.user) return null
  const sanitizedPayload = {
    user: { ...payload.user },
    session: {
      token: payload.session.token,
      expiresAt: payload.session.expiresAt || '',
    },
  }
  writeJsonStorage(STORAGE_KEYS.authSession, sanitizedPayload)
  writeJsonStorage(STORAGE_KEYS.account, normalizeDemoAccount({
    ...payload.user,
    accountId: payload.user.id,
    loginType: payload.user.loginType || '',
    provider: payload.user.provider || '',
    displayName: payload.user.displayName || '小饭同学',
  }))
  return sanitizedPayload
}

export function clearAuthSession() {
  removeStorageValue(STORAGE_KEYS.authSession)
  removeStorageValue(STORAGE_KEYS.account)
}

export function readDemoAccount() {
  const authSession = readAuthSession()
  if (authSession?.user) return normalizeDemoAccount({
    ...authSession.user,
    accountId: authSession.user.id,
    loginType: authSession.user.loginType || '',
    provider: authSession.user.provider || '',
  })
  removeStorageValue(STORAGE_KEYS.account)
  return null
}

export function saveDemoAccount(account) {
  const normalizedAccount = normalizeDemoAccount(account) || { accountId: getOrCreateMealOwnerKey(), displayName: '小饭同学' }
  writeJsonStorage(STORAGE_KEYS.account, normalizedAccount)
  return normalizedAccount
}

export function clearDemoAccount() {
  clearAuthSession()
}

export function getFavoriteActiveCollectionId() {
  if (typeof window === 'undefined') return ''
  return readStorageValue(STORAGE_KEYS.favoriteActiveCollection)
}

export function setFavoriteActiveCollectionId(collectionId) {
  if (typeof window === 'undefined') return
  if (!collectionId) {
    removeStorageValue(STORAGE_KEYS.favoriteActiveCollection)
    return
  }
  writeStorageValue(STORAGE_KEYS.favoriteActiveCollection, collectionId)
}
