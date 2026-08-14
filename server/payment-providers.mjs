import crypto from 'node:crypto'
import fs from 'node:fs/promises'

const WECHAT_NATIVE_PATH = '/v3/pay/transactions/native'

function cleanString(value, maximum = 300) {
  return String(value || '').trim().slice(0, maximum)
}

function ensureHttpsUrl(value, label) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error(`${label} 必须使用 HTTPS。`)
  return url.toString()
}

function isPresent(value) {
  return Boolean(cleanString(value, 4_000))
}

function createNonce() {
  return crypto.randomBytes(16).toString('hex')
}

function signRsaSha256(content, privateKey) {
  return crypto.sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64')
}

function verifyRsaSha256(content, signature, publicKey) {
  try {
    return crypto.verify('RSA-SHA256', Buffer.from(content), publicKey, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function extractTopLevelJsonObject(rawJson, propertyName) {
  const propertyIndex = rawJson.indexOf(`"${propertyName}"`)
  if (propertyIndex < 0) return ''
  const start = rawJson.indexOf('{', propertyIndex + propertyName.length + 2)
  if (start < 0) return ''
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < rawJson.length; index += 1) {
    const character = rawJson[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return rawJson.slice(start, index + 1)
    }
  }
  return ''
}

function serializeAlipaySignContent(parameters) {
  return Object.entries(parameters)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '' && value !== undefined && value !== null)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function decryptWechatResource(resource, apiV3Key) {
  if (!resource?.ciphertext || !resource?.nonce) throw new Error('微信支付通知资源不完整。')
  const ciphertext = Buffer.from(resource.ciphertext, 'base64')
  if (ciphertext.length <= 16) throw new Error('微信支付通知密文无效。')
  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resource.nonce, 'utf8'))
  decipher.setAuthTag(authTag)
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'))
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'))
}

function formatAlipayTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function normalizePaymentProviderConfig(config = {}) {
  const notifyBaseUrl = cleanString(config.notifyBaseUrl, 500).replace(/\/+$/, '')
  const wechat = {
    mchId: cleanString(config.wechat?.mchId, 40),
    appId: cleanString(config.wechat?.appId, 40),
    certificateSerial: cleanString(config.wechat?.certificateSerial, 128),
    privateKeyPath: cleanString(config.wechat?.privateKeyPath, 500),
    apiV3Key: cleanString(config.wechat?.apiV3Key, 64),
    publicKeyId: cleanString(config.wechat?.publicKeyId, 128),
    publicKeyPath: cleanString(config.wechat?.publicKeyPath, 500),
  }
  const alipay = {
    appId: cleanString(config.alipay?.appId, 40),
    sellerId: cleanString(config.alipay?.sellerId, 40),
    privateKeyPath: cleanString(config.alipay?.privateKeyPath, 500),
    publicKeyPath: cleanString(config.alipay?.publicKeyPath, 500),
    gateway: cleanString(config.alipay?.gateway, 500) || 'https://openapi.alipay.com/gateway.do',
  }
  const wechatConfigured = Boolean(notifyBaseUrl && Object.values(wechat).every(isPresent) && wechat.apiV3Key.length === 32)
  const alipayConfigured = Boolean(notifyBaseUrl && Object.values(alipay).every(isPresent))
  const devConfigured = Boolean(config.isDevelopment && config.devSimulation)
  return { notifyBaseUrl, wechat, alipay, wechatConfigured, alipayConfigured, devConfigured }
}

export function createPaymentProviderGateway(rawConfig = {}, { fetchImpl = globalThis.fetch, readFileImpl = fs.readFile } = {}) {
  const config = normalizePaymentProviderConfig(rawConfig)
  const keyCache = new Map()

  async function readKey(filePath) {
    if (keyCache.has(filePath)) return keyCache.get(filePath)
    const value = await readFileImpl(filePath, 'utf8')
    keyCache.set(filePath, value)
    return value
  }

  function status() {
    return {
      wechat: { configured: config.wechatConfigured, label: '微信支付' },
      alipay: { configured: config.alipayConfigured, label: '支付宝' },
      dev: { configured: config.devConfigured, label: '开发测试（不扣款）' },
    }
  }

  async function createWechatOrder(order) {
    if (!config.wechatConfigured) throw Object.assign(new Error('微信支付商户参数尚未配置。'), { code: 'provider_not_configured' })
    const privateKey = await readKey(config.wechat.privateKeyPath)
    const body = JSON.stringify({
      appid: config.wechat.appId,
      mchid: config.wechat.mchId,
      description: cleanString(order.description, 127),
      out_trade_no: order.outTradeNo,
      time_expire: order.expiresAt.toISOString(),
      notify_url: ensureHttpsUrl(`${config.notifyBaseUrl}/api/billing/webhooks/wechat`, '微信支付回调地址'),
      amount: { total: order.amountFen, currency: order.currency },
    })
    const timestamp = Math.floor(Date.now() / 1_000).toString()
    const nonce = createNonce()
    const signature = signRsaSha256(`POST\n${WECHAT_NATIVE_PATH}\n${timestamp}\n${nonce}\n${body}\n`, privateKey)
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.wechat.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.wechat.certificateSerial}",signature="${signature}"`
    const response = await fetchImpl(`https://api.mch.weixin.qq.com${WECHAT_NATIVE_PATH}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authorization },
      body,
    })
    const payload = safeJson(await response.text()) || {}
    if (!response.ok || !payload.code_url) {
      throw Object.assign(new Error(cleanString(payload.message, 240) || `微信支付下单失败（HTTP ${response.status}）。`), { code: cleanString(payload.code, 80) || 'wechat_order_failed' })
    }
    return { qrPayload: payload.code_url, providerResponse: { codeUrlIssued: true } }
  }

  async function createAlipayOrder(order) {
    if (!config.alipayConfigured) throw Object.assign(new Error('支付宝商户参数尚未配置。'), { code: 'provider_not_configured' })
    const privateKey = await readKey(config.alipay.privateKeyPath)
    const parameters = {
      app_id: config.alipay.appId,
      method: 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: formatAlipayTimestamp(),
      version: '1.0',
      notify_url: ensureHttpsUrl(`${config.notifyBaseUrl}/api/billing/webhooks/alipay`, '支付宝回调地址'),
      biz_content: JSON.stringify({
        out_trade_no: order.outTradeNo,
        total_amount: (order.amountFen / 100).toFixed(2),
        subject: cleanString(order.description, 256),
        timeout_express: '15m',
      }),
    }
    parameters.sign = signRsaSha256(serializeAlipaySignContent(parameters), privateKey)
    const response = await fetchImpl(config.alipay.gateway, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(parameters),
    })
    const responseText = await response.text()
    const payload = safeJson(responseText) || {}
    const result = payload.alipay_trade_precreate_response || {}
    const publicKey = await readKey(config.alipay.publicKeyPath)
    const signedResult = extractTopLevelJsonObject(responseText, 'alipay_trade_precreate_response')
    if (!payload.sign || !verifyRsaSha256(signedResult, payload.sign, publicKey)) {
      throw Object.assign(new Error('支付宝下单响应验签失败。'), { code: 'alipay_response_signature_invalid' })
    }
    if (!response.ok || result.code !== '10000' || !result.qr_code) {
      throw Object.assign(new Error(cleanString(result.sub_msg || result.msg, 240) || `支付宝下单失败（HTTP ${response.status}）。`), { code: cleanString(result.sub_code || result.code, 80) || 'alipay_order_failed' })
    }
    return { qrPayload: result.qr_code, providerResponse: { qrCodeIssued: true } }
  }

  async function createOrder(provider, order) {
    if (provider === 'wechat') return createWechatOrder(order)
    if (provider === 'alipay') return createAlipayOrder(order)
    if (provider === 'dev' && config.devConfigured) return { qrPayload: `mealapp-dev-pay://${order.outTradeNo}`, providerResponse: { simulated: true } }
    throw Object.assign(new Error('支付通道尚未配置。'), { code: 'provider_not_configured' })
  }

  async function parseWechatNotification({ headers, rawBody }) {
    if (!config.wechatConfigured) throw new Error('微信支付商户参数尚未配置。')
    const timestamp = cleanString(headers['wechatpay-timestamp'], 32)
    const nonce = cleanString(headers['wechatpay-nonce'], 80)
    const signature = cleanString(headers['wechatpay-signature'], 1_024)
    const serial = cleanString(headers['wechatpay-serial'], 160)
    if (!/^\d{10}$/.test(timestamp) || !nonce || !signature || serial !== config.wechat.publicKeyId) throw new Error('微信支付通知签名头无效。')
    if (Math.abs(Date.now() / 1_000 - Number(timestamp)) > 300) throw new Error('微信支付通知时间戳已过期。')
    const publicKey = await readKey(config.wechat.publicKeyPath)
    if (!verifyRsaSha256(`${timestamp}\n${nonce}\n${rawBody}\n`, signature, publicKey)) throw new Error('微信支付通知验签失败。')
    const envelope = safeJson(rawBody)
    const transaction = decryptWechatResource(envelope?.resource, config.wechat.apiV3Key)
    return {
      providerEventId: `${envelope.id || transaction.transaction_id}:${envelope.event_type || transaction.trade_state}`,
      eventType: envelope.event_type || 'TRANSACTION.SUCCESS',
      outTradeNo: cleanString(transaction.out_trade_no, 32),
      providerTradeNo: cleanString(transaction.transaction_id, 96),
      paid: transaction.trade_state === 'SUCCESS',
      amountFen: Number(transaction.amount?.total),
      currency: cleanString(transaction.amount?.currency, 3),
      merchantId: cleanString(transaction.mchid, 40),
      appId: cleanString(transaction.appid, 40),
      payload: {
        id: cleanString(envelope.id, 160),
        eventType: cleanString(envelope.event_type, 60),
        transactionId: cleanString(transaction.transaction_id, 96),
        tradeState: cleanString(transaction.trade_state, 40),
      },
    }
  }

  async function parseAlipayNotification({ body }) {
    if (!config.alipayConfigured) throw new Error('支付宝商户参数尚未配置。')
    const publicKey = await readKey(config.alipay.publicKeyPath)
    const signature = cleanString(body?.sign, 1_024)
    if (!signature || !verifyRsaSha256(serializeAlipaySignContent(body || {}), signature, publicKey)) throw new Error('支付宝通知验签失败。')
    return {
      providerEventId: `${cleanString(body.notify_id, 128) || cleanString(body.trade_no, 96)}:${cleanString(body.trade_status, 40)}`,
      eventType: cleanString(body.trade_status, 60) || 'trade_status_sync',
      outTradeNo: cleanString(body.out_trade_no, 32),
      providerTradeNo: cleanString(body.trade_no, 96),
      paid: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(body.trade_status),
      amountFen: Math.round(Number(body.total_amount) * 100),
      currency: 'CNY',
      merchantId: cleanString(body.seller_id, 40),
      appId: cleanString(body.app_id, 40),
      payload: {
        notifyId: cleanString(body.notify_id, 128),
        tradeNo: cleanString(body.trade_no, 96),
        tradeStatus: cleanString(body.trade_status, 40),
        outTradeNo: cleanString(body.out_trade_no, 32),
        totalAmount: cleanString(body.total_amount, 24),
      },
    }
  }

  async function parseNotification(provider, request) {
    if (provider === 'wechat') return parseWechatNotification(request)
    if (provider === 'alipay') return parseAlipayNotification(request)
    throw new Error('不支持的支付通知来源。')
  }

  function validateNotificationIdentity(provider, notification) {
    if (provider === 'wechat') return notification.merchantId === config.wechat.mchId && notification.appId === config.wechat.appId
    if (provider === 'alipay') return notification.merchantId === config.alipay.sellerId && notification.appId === config.alipay.appId
    return provider === 'dev' && config.devConfigured
  }

  return { createOrder, parseNotification, status, validateNotificationIdentity }
}

export { serializeAlipaySignContent }
