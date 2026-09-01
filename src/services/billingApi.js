import { getAuthToken } from './session'

const billingApiBaseUrl = import.meta.env.VITE_BILLING_API_URL || import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'

export class BillingApiError extends Error {
  constructor(message, code = 'billing_request_failed', status = 0, payload = null) {
    super(message)
    this.name = 'BillingApiError'
    this.code = code
    this.status = status
    this.payload = payload
  }
}

async function requestBilling(pathname, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 10_000)
  try {
    const token = getAuthToken()
    const response = await fetch(`${billingApiBaseUrl}${pathname}`, {
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
    try { payload = rawPayload ? JSON.parse(rawPayload) : null } catch {}
    if (!response.ok) {
      throw new BillingApiError(
        payload?.message || payload?.error || `会员服务返回 ${response.status}`,
        payload?.error || 'billing_request_failed',
        response.status,
        payload,
      )
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') throw new BillingApiError('支付服务响应超时，请稍后再试。', 'billing_timeout')
    if (error instanceof BillingApiError) throw error
    throw new BillingApiError('暂时连不上会员服务，请确认后端已启动。', 'billing_network_error')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function listBillingProducts() {
  return requestBilling('/api/billing/products')
}

export function readMembership() {
  return requestBilling('/api/membership/me', { timeoutMs: 6_000 })
}

export function createBillingOrder({ productCode, provider, idempotencyKey }) {
  return requestBilling('/api/billing/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { productCode, provider },
  })
}

export function readBillingOrder(orderId) {
  return requestBilling(`/api/billing/orders/${encodeURIComponent(orderId)}`, { timeoutMs: 6_000 })
}

export function listBillingOrders(limit = 20) {
  return requestBilling(`/api/billing/orders?limit=${Math.max(1, Math.min(50, Number(limit) || 20))}`, { timeoutMs: 6_000 })
}

export function reconcileBillingOrder(orderId) {
  return requestBilling(`/api/billing/orders/${encodeURIComponent(orderId)}/reconcile`, {
    method: 'POST',
    timeoutMs: 15_000,
  })
}

export function completeDevelopmentOrder(orderId) {
  return requestBilling(`/api/billing/dev/orders/${encodeURIComponent(orderId)}/complete`, {
    method: 'POST',
  })
}
