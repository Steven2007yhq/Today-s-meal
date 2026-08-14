const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const FOOD_SCOPE_PATTERN = /吃|饭|菜|餐|营养|热量|卡路里|蛋白|碳水|脂肪|食谱|食材|烹饪|早餐|午餐|晚餐|加餐|减脂|减肥|增肌|健身|训练|控糖|血糖|血压|血脂|健康|疾病|过敏|忌口|食物|食品|水果|蔬菜|肉|鱼|蛋|奶|豆|辣|甜|咸|饿|膳食|维生素|矿物质|盐|油|糖|克|千卡/i

function isFoodRelated(message) {
  return FOOD_SCOPE_PATTERN.test(String(message || ''))
}

function createAiService({ app, fetchImpl = globalThis.fetch }) {
  const gatewayUrl = String(process.env.MEAL_AI_GATEWAY_URL || 'http://127.0.0.1:8787').trim().replace(/\/+$/, '')
  const gatewayToken = String(process.env.MEAL_AI_GATEWAY_TOKEN || '').trim()
  let clientId = ''

  function getClientId() {
    if (clientId) return clientId
    const clientFile = path.join(app.getPath('userData'), 'ai-client.json')
    try {
      const stored = JSON.parse(fs.readFileSync(clientFile, 'utf8'))
      if (/^[a-zA-Z0-9._:-]{8,128}$/.test(String(stored?.clientId || ''))) {
        clientId = stored.clientId
        return clientId
      }
    } catch {}
    clientId = crypto.randomUUID()
    fs.mkdirSync(path.dirname(clientFile), { recursive: true })
    fs.writeFileSync(clientFile, JSON.stringify({ clientId }, null, 2), { encoding: 'utf8', mode: 0o600 })
    return clientId
  }

  async function requestGateway(route, options = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持网络请求。')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60_000)
    const headers = {
      Accept: 'application/json',
      'X-Meal-Client-Id': getClientId(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}),
    }
    try {
      const response = await fetchImpl(`${gatewayUrl}${route}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
      const text = await response.text()
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch {
        payload = {}
      }
      if (!response.ok) {
        const error = new Error(payload.message || `AI 网关请求失败（HTTP ${response.status}）。`)
        error.code = payload.error || 'gateway_error'
        throw error
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('AI 网关响应超时，请稍后再试。')
        timeoutError.code = 'timeout'
        throw timeoutError
      }
      if (!error.code && /fetch|network|socket|ENOTFOUND|ECONN/i.test(String(error.message))) {
        error.message = '无法连接小饭 AI 后台，请检查服务是否已启动。'
        error.code = 'network_error'
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async function getPublicConfiguration() {
    try {
      const status = await requestGateway('/api/ai/status', { timeoutMs: 8_000 })
      return {
        serviceId: 'meal-ai',
        serviceName: '小饭 AI',
        endpoint: '平台托管',
        managed: true,
        configured: Boolean(status.ready),
        ready: Boolean(status.ready),
        allocation: 'server-managed',
        configurationIssue: status.ready ? '' : '小饭 AI 后台通道尚未就绪。',
      }
    } catch (error) {
      return {
        serviceId: 'meal-ai',
        serviceName: '小饭 AI',
        endpoint: '平台托管',
        managed: true,
        configured: false,
        ready: false,
        allocation: 'server-managed',
        configurationIssue: error instanceof Error ? error.message : '小饭 AI 后台暂不可用。',
      }
    }
  }

  async function chat(payload) {
    const messages = Array.isArray(payload?.messages) ? payload.messages : []
    const latestUserMessage = [...messages].reverse().find((message) => message?.role === 'user')?.content || ''
    if (!latestUserMessage || !isFoodRelated(latestUserMessage)) {
      return { content: '这题有点超出厨房管辖范围啦，我只能聊吃饭、营养和食谱。', local: true }
    }
    try {
      return await requestGateway('/api/ai/chat', { method: 'POST', body: payload })
    } catch (error) {
      if (error?.code === 'ai_key_pool_unconfigured') {
        return { demo: true, reason: 'gateway_not_configured', configured: false }
      }
      return {
        demo: false,
        configured: true,
        apiError: error instanceof Error ? error.message : '小饭 AI 请求失败。',
        errorCode: error?.code || 'unknown_error',
      }
    }
  }

  async function testConnection() {
    try {
      return await requestGateway('/api/ai/test', { method: 'POST', timeoutMs: 25_000 })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '连接测试失败。', errorCode: error?.code || 'unknown_error' }
    }
  }

  return { chat, getPublicConfiguration, testConnection }
}

module.exports = { createAiService, isFoodRelated }
