import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const FOOD_SCOPE_PATTERN = /吃|饭|菜|餐|营养|热量|卡路里|蛋白|碳水|脂肪|食谱|食材|烹饪|早餐|午餐|晚餐|加餐|减脂|减肥|增肌|健身|训练|控糖|血糖|血压|血脂|健康|疾病|过敏|忌口|食物|食品|水果|蔬菜|肉|鱼|蛋|奶|豆|辣|甜|咸|饿|膳食|维生素|矿物质|盐|油|糖|克|千卡/i
const RETRYABLE_KEY_ERRORS = new Set(['invalid_key', 'insufficient_balance', 'rate_limited', 'provider_unavailable'])
const ALLOWED_MODULES = new Set(['standard', 'family', 'elder', 'fitness'])

export function isFoodRelated(message) {
  return FOOD_SCOPE_PATTERN.test(String(message || ''))
}

export function normalizeClientId(value) {
  const clientId = String(value || '').trim()
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(clientId) ? clientId : ''
}

export function selectAssignedKeyIndex(clientId, keyCount, assignmentSecret) {
  if (!Number.isInteger(keyCount) || keyCount < 1) return -1
  const digest = crypto.createHmac('sha256', assignmentSecret).update(clientId).digest()
  return digest.readUInt32BE(0) % keyCount
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .map((message) => ({ role: message.role, content: String(message.content || '').trim().slice(0, 2_000) }))
    .filter((message) => message.content)
    .slice(-8)
}

function compactMeal(meal) {
  if (!meal || typeof meal !== 'object') return null
  const title = String(meal.title || '').trim().slice(0, 80)
  if (!title) return null
  const type = String(meal.type || '餐食').trim().slice(0, 20)
  const description = String(meal.description || '').trim().slice(0, 180)
  const kcal = Number.isFinite(Number(meal.kcal)) ? Math.round(Number(meal.kcal)) : null
  const portion = Number.isFinite(Number(meal.portionMultiplier)) ? Number(meal.portionMultiplier).toFixed(2) : null
  return `${type}：${title}${description ? `（${description}）` : ''}${kcal ? `，约 ${kcal} kcal` : ''}${portion ? `，份量系数 ${portion}` : ''}`
}

function buildMealContext(context) {
  if (!context || typeof context !== 'object') return ''
  const currentMeals = Array.isArray(context.currentMeals) ? context.currentMeals.map(compactMeal).filter(Boolean).slice(0, 8) : []
  const recentMeals = Array.isArray(context.recentMeals) ? context.recentMeals.map(compactMeal).filter(Boolean).slice(-12) : []
  if (!currentMeals.length && !recentMeals.length) return ''
  const sections = []
  if (currentMeals.length) sections.push(`<current_meal_plan authoritative="true">\n- ${currentMeals.join('\n- ')}\n</current_meal_plan>`)
  if (recentMeals.length) sections.push(`<historical_portion_records>\n- ${recentMeals.join('\n- ')}\n</historical_portion_records>`)
  return `以下是应用在本次提问时刚读取的实时饮食数据。current_meal_plan 是今天当前有效的三餐安排，优先级高于此前对话中出现的旧菜名、旧用量和旧热量；historical_portion_records 仅用于估算饭量，不能替代当前菜单。若用户要求重新计算、汇总或评价今天三餐，必须逐项使用 current_meal_plan 中的最新菜名与数据，并忽略冲突的旧回答。\n${sections.join('\n')}`
}

function friendlyHttpError(status) {
  if (status === 401 || status === 403) return { code: 'invalid_key', message: '平台 AI 凭证暂时不可用。' }
  if (status === 402) return { code: 'insufficient_balance', message: '平台 AI 额度暂时不足。' }
  if (status === 408) return { code: 'timeout', message: 'DeepSeek 响应超时，请稍后再试。' }
  if (status === 429) return { code: 'rate_limited', message: '请求太频繁了，让小饭歇几秒再试。' }
  if (status >= 500) return { code: 'provider_unavailable', message: 'DeepSeek 正在开小差，请稍后再试。' }
  return { code: 'request_failed', message: `DeepSeek 请求失败（HTTP ${status}）。` }
}

export function createDeepSeekGateway({ apiKeys, endpoint, model, assignmentSecret, promptDirectory, fetchImpl = globalThis.fetch }) {
  const keyPool = [...new Set((apiKeys || []).map((key) => String(key).trim()).filter(Boolean))]
  let requestSequence = 0

  function getStatus() {
    return {
      provider: 'deepseek',
      providerName: 'DeepSeek',
      model,
      managed: true,
      ready: keyPool.length > 0,
      configured: keyPool.length > 0,
      allocation: 'server-managed',
    }
  }

  async function requestCompletion(apiKey, messages, options = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('当前服务器不支持网络请求。')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 45_000)
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.55,
          max_tokens: options.maxTokens || 900,
          messages,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detail = friendlyHttpError(response.status)
        const error = new Error(detail.message)
        error.code = detail.code
        throw error
      }
      const data = await response.json()
      const content = String(data?.choices?.[0]?.message?.content || '').trim()
      if (!content) {
        const error = new Error('DeepSeek 返回了空内容，请重新提问。')
        error.code = 'empty_response'
        throw error
      }
      return content.slice(0, 12_000)
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('DeepSeek 响应超时，请稍后再试。')
        timeoutError.code = 'timeout'
        throw timeoutError
      }
      if (!error.code && /fetch|network|socket|ENOTFOUND|ECONN/i.test(String(error.message))) {
        error.message = '后台无法连接 DeepSeek，请稍后再试。'
        error.code = 'network_error'
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async function requestWithAssignedKey(clientId, messages, options) {
    if (!keyPool.length) {
      const error = new Error('后台尚未配置 DeepSeek 密钥池。')
      error.code = 'key_pool_unconfigured'
      throw error
    }
    const assignedIndex = selectAssignedKeyIndex(clientId, keyPool.length, assignmentSecret)
    let lastError = null
    for (let offset = 0; offset < keyPool.length; offset += 1) {
      const keyIndex = (assignedIndex + offset) % keyPool.length
      try {
        return await requestCompletion(keyPool[keyIndex], messages, options)
      } catch (error) {
        lastError = error
        if (!RETRYABLE_KEY_ERRORS.has(error?.code)) throw error
      }
    }
    throw lastError || new Error('DeepSeek 密钥池暂时不可用。')
  }

  async function chat(payload, clientId) {
    const safeMessages = sanitizeMessages(payload?.messages)
    const latestUserIndex = safeMessages.map((message) => message.role).lastIndexOf('user')
    const latestUser = safeMessages[latestUserIndex]
    if (!latestUser?.content || !isFoodRelated(latestUser.content)) {
      return { content: '这题有点超出厨房管辖范围啦，我只能聊吃饭、营养和食谱。', local: true }
    }

    const moduleName = ALLOWED_MODULES.has(payload?.module) ? payload.module : 'standard'
    const systemPrompt = await fs.readFile(path.join(promptDirectory, `${moduleName}.md`), 'utf8')
    const conversationHistory = safeMessages.slice(0, latestUserIndex)
    const liveMealContext = buildMealContext(payload?.context)
    const content = await requestWithAssignedKey(clientId, [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      ...(liveMealContext ? [{ role: 'system', content: liveMealContext }] : []),
      latestUser,
    ])
    requestSequence += 1
    return {
      content,
      demo: false,
      configured: true,
      provider: 'DeepSeek',
      model,
      requestId: `${Date.now().toString(36)}-${requestSequence.toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    }
  }

  async function testConnection(clientId) {
    try {
      await requestWithAssignedKey(clientId, [
        { role: 'system', content: '你是饮食助手连接检测程序。' },
        { role: 'user', content: '只回复四个字：连接成功' },
      ], { temperature: 0.1, maxTokens: 24, timeoutMs: 20_000 })
      return { ok: true, provider: 'DeepSeek', model }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '连接测试失败。', errorCode: error?.code || 'unknown_error' }
    }
  }

  return { chat, getStatus, testConnection }
}
