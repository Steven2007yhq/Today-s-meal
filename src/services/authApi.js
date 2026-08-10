import { clearAuthSession, getAuthToken, saveAuthSession } from './session'

const authApiBaseUrl = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'

export class AuthApiError extends Error {
  constructor(message, code = 'auth_request_failed', status = 0, payload = null) {
    super(message)
    this.name = 'AuthApiError'
    this.code = code
    this.status = status
    this.payload = payload
  }
}

function createAbortController(timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeout }
}

async function requestAuth(pathname, options = {}) {
  const { controller, timeout } = createAbortController(options.timeoutMs || 8000)
  try {
    const token = getAuthToken()
    const response = await fetch(`${authApiBaseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const rawPayload = await response.text()
    let payload = null
    try {
      payload = rawPayload ? JSON.parse(rawPayload) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      throw new AuthApiError(
        payload?.message || payload?.error || `认证服务返回 ${response.status}`,
        payload?.error || 'auth_request_failed',
        response.status,
        payload,
      )
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AuthApiError('认证服务响应超时，请稍后再试。', 'auth_timeout')
    }
    if (error instanceof AuthApiError) throw error
    throw new AuthApiError('暂时连不上账号服务，请确认后端已启动。', 'auth_network_error')
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function sendVerificationCode({ channel, identifier, purpose, captchaToken }) {
  return requestAuth('/api/auth/send-code', {
    method: 'POST',
    body: { channel, identifier, purpose, captchaToken },
  })
}

export async function registerAccount({ channel, identifier, password, code, captchaToken, displayName }) {
  const payload = await requestAuth('/api/auth/register', {
    method: 'POST',
    body: { channel, identifier, password, code, captchaToken, displayName },
  })
  if (payload?.session?.token) saveAuthSession(payload)
  return payload
}

export async function loginAccount({ channel, identifier, password, code, captchaToken }) {
  const payload = await requestAuth('/api/auth/login', {
    method: 'POST',
    body: { channel, identifier, password, code, captchaToken },
  })
  if (payload?.session?.token) saveAuthSession(payload)
  return payload
}

export async function readCurrentAuthSession() {
  if (!getAuthToken()) return null
  try {
    const payload = await requestAuth('/api/auth/me', { timeoutMs: 5000 })
    if (payload?.user) saveAuthSession(payload)
    return payload
  } catch (error) {
    if (error?.status === 401 || error?.code === 'session_invalid') clearAuthSession()
    return null
  }
}

export async function logoutAccount() {
  try {
    await requestAuth('/api/auth/logout', { method: 'POST', timeoutMs: 4000 })
  } finally {
    clearAuthSession()
  }
}

export async function startSocialLogin(provider) {
  return requestAuth(`/api/auth/oauth/${encodeURIComponent(provider)}/start`, { timeoutMs: 5000 })
}
