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

function compactTrainingSession(training) {
  if (!training || typeof training !== 'object') return null
  const type = String(training.type || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!type) return null
  const rawDuration = Number(training.durationMinutes)
  const duration = Number.isFinite(rawDuration) ? Math.min(240, Math.max(0, Math.round(rawDuration))) : null
  const intensity = ['低', '中等', '高'].includes(training.intensity) ? training.intensity : ''
  const focus = String(training.focus || '').replace(/\s+/g, ' ').trim().slice(0, 100)
  return `${type}${duration === 0 ? '（休息恢复）' : duration ? ` ${duration} 分钟` : ''}${intensity ? `，${intensity}强度` : ''}${focus ? `，关注 ${focus}` : ''}`
}

function compactTraining(training) {
  if (!training || typeof training !== 'object') return null
  const day = String(training.day || '').replace(/\s+/g, ' ').trim().slice(0, 12)
  if (!day) return null
  const sessions = Array.isArray(training.sessions) ? training.sessions.map(compactTrainingSession).filter(Boolean).slice(0, 6) : []
  if (sessions.length) {
    const rawTotal = Number(training.totalDurationMinutes)
    const total = Number.isFinite(rawTotal) ? Math.min(720, Math.max(0, Math.round(rawTotal))) : null
    return `${day}：${sessions.join('；')}${total ? `；全天合计 ${total} 分钟` : ''}`
  }
  const legacySession = compactTrainingSession(training)
  return legacySession ? `${day}：${legacySession}` : null
}

function cleanContextText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function compactFamilyProfile(profile) {
  if (!profile || typeof profile !== 'object' || !Array.isArray(profile.members)) return null
  const members = profile.members.slice(0, 8).map((member) => {
    if (!member || typeof member !== 'object') return null
    const role = cleanContextText(member.role, 20) || '家庭成员'
    const ageGroup = cleanContextText(member.ageGroup, 20) || '年龄段未提供'
    const portion = Number(member.portionMultiplier)
    const portionText = Number.isFinite(portion) ? `，饭量 ${Math.min(2.5, Math.max(0.3, portion)).toFixed(1)} 倍标准份` : ''
    const avoidance = cleanContextText(member.foodAvoidance, 120)
    return `${role}（${ageGroup}${portionText}${avoidance ? `，个人忌口/过敏：${avoidance}` : ''}）`
  }).filter(Boolean)
  if (!members.length) return null
  const sharedAvoidance = cleanContextText(profile.sharedFoodAvoidance, 180)
  return `${members.join('；')}${sharedAvoidance ? `；全家共同避开：${sharedAvoidance}` : ''}`
}

const ELDER_GOAL_LABELS = Object.freeze({
  'low-salt': '少盐清淡',
  'balanced-carb': '主食粗细搭配',
  calcium: '补钙与骨骼关怀',
  protein: '保证优质蛋白',
  'soft-food': '软烂易嚼',
})
const ELDER_CONDITION_LABELS = Object.freeze({
  hypertension: '高血压',
  diabetes: '糖尿病或血糖异常',
  hyperlipidemia: '高血脂',
  kidney: '肾功能相关疾病',
  gout: '痛风或高尿酸',
  osteoporosis: '骨质疏松',
})
const ELDER_CHEWING_LABELS = Object.freeze({ not_disclosed: '不愿透露', normal: '正常咀嚼', soft: '偏好软一点', very_soft: '需要软烂细碎' })
const ELDER_SWALLOWING_LABELS = Object.freeze({ not_disclosed: '不愿透露', normal: '无特别需要', needs_attention: '需要特别留意' })

function compactElderProfile(profile) {
  if (!profile || typeof profile !== 'object') return null
  const disclosure = ['not_disclosed', 'none_known', 'shared'].includes(profile.diseaseDisclosure) ? profile.diseaseDisclosure : 'not_disclosed'
  const ageGroup = cleanContextText(profile.ageGroup, 20) || '不愿透露'
  const chewing = ELDER_CHEWING_LABELS[profile.chewing] || '不愿透露'
  const swallowing = ELDER_SWALLOWING_LABELS[profile.swallowing] || '不愿透露'
  const goals = Array.isArray(profile.careGoals) ? [...new Set(profile.careGoals.map((goal) => ELDER_GOAL_LABELS[goal]).filter(Boolean))].slice(0, 5) : []
  const sections = [`年龄段：${ageGroup}`, `咀嚼：${chewing}`, `吞咽：${swallowing}`, `饮食重点：${goals.length ? goals.join('、') : '未设置'}`]
  if (disclosure === 'not_disclosed') {
    sections.push('疾病史：用户明确选择“不愿透露”；禁止猜测、反推、默认存在某种疾病或要求用户补填')
  } else if (disclosure === 'none_known') {
    sections.push('疾病史：用户填写“暂无已知相关疾病”；不得把这句话解释为医学诊断或健康保证')
  } else {
    const conditions = Array.isArray(profile.conditions) ? [...new Set(profile.conditions.map((condition) => ELDER_CONDITION_LABELS[condition]).filter(Boolean))].slice(0, 6) : []
    const otherCondition = cleanContextText(profile.otherCondition, 120)
    const conditionText = [...conditions, ...(otherCondition ? [otherCondition] : [])]
    sections.push(`疾病史：用户愿意填写；${conditionText.length ? conditionText.join('、') : '尚未填写具体疾病'}`)
  }
  const medicationNote = cleanContextText(profile.medicationNote, 160)
  const foodAvoidance = cleanContextText(profile.foodAvoidance, 160)
  if (medicationNote) sections.push(`与饮食有关的用药提醒：${medicationNote}`)
  if (foodAvoidance) sections.push(`忌口/过敏/不喜欢：${foodAvoidance}`)
  return sections.join('；')
}

function buildMealContext(context) {
  if (!context || typeof context !== 'object') return ''
  const currentMeals = Array.isArray(context.currentMeals) ? context.currentMeals.map(compactMeal).filter(Boolean).slice(0, 8) : []
  const recentMeals = Array.isArray(context.recentMeals) ? context.recentMeals.map(compactMeal).filter(Boolean).slice(-12) : []
  const currentTraining = compactTraining(context.fitnessTraining?.today)
  const weeklyTraining = Array.isArray(context.fitnessTraining?.week) ? context.fitnessTraining.week.map(compactTraining).filter(Boolean).slice(0, 7) : []
  const familyProfile = compactFamilyProfile(context.familyProfile)
  const elderProfile = compactElderProfile(context.elderProfile)
  if (!currentMeals.length && !recentMeals.length && !currentTraining && !weeklyTraining.length && !familyProfile && !elderProfile) return ''
  const sections = []
  if (currentMeals.length) sections.push(`<current_meal_plan authoritative="true">\n- ${currentMeals.join('\n- ')}\n</current_meal_plan>`)
  if (recentMeals.length) sections.push(`<historical_portion_records>\n- ${recentMeals.join('\n- ')}\n</historical_portion_records>`)
  if (currentTraining) sections.push(`<current_training_plan authoritative="true">\n- ${currentTraining}\n</current_training_plan>`)
  if (weeklyTraining.length) sections.push(`<weekly_training_schedule>\n- ${weeklyTraining.join('\n- ')}\n</weekly_training_schedule>`)
  if (familyProfile) sections.push(`<family_diet_profile authoritative="true">\n- ${familyProfile}\n</family_diet_profile>`)
  if (elderProfile) sections.push(`<elder_diet_profile authoritative="true" sensitive="true">\n- ${elderProfile}\n</elder_diet_profile>`)
  return `以下是应用在本次提问时刚读取的实时数据。current_meal_plan 是今天当前有效的三餐安排；current_training_plan 是用户刚编辑的今天全部训练项目、各段时长和强度；family_diet_profile 与 elder_diet_profile 是用户主动保存的当前场景档案；这些实时数据优先于此前对话中的旧信息。historical_portion_records 仅用于估算饭量，weekly_training_schedule 用于观察训练与恢复节奏。回答家庭问题时应逐位使用成员饭量、年龄段与忌口，不得把一人的敏感或过敏信息套用到其他成员。回答乐龄问题时只能使用用户明确填写的信息；若疾病史为“不愿透露”，必须尊重该选择，不猜测、不反推、不默认任何疾病，也不施压补填，可基于已填写的进食习惯给一般性饮食建议。回答健身营养问题时必须逐项识别当天训练并结合全天总训练量，据此调整分段进食、碳水、蛋白质和补水建议；不得把多项训练误认为一项，也不得虚构未提供的体重、体脂、运动消耗、疾病或伤病数据。\n${sections.join('\n')}`
}

function friendlyHttpError(status) {
  if (status === 401 || status === 403) return { code: 'invalid_key', message: '小饭 AI 服务凭证暂时不可用。' }
  if (status === 402) return { code: 'insufficient_balance', message: '小饭 AI 服务额度暂时不足。' }
  if (status === 408) return { code: 'timeout', message: '小饭 AI 响应超时，请稍后再试。' }
  if (status === 429) return { code: 'rate_limited', message: '请求太频繁了，让小饭歇几秒再试。' }
  if (status >= 500) return { code: 'provider_unavailable', message: '小饭 AI 正在开小差，请稍后再试。' }
  return { code: 'request_failed', message: `小饭 AI 请求失败（HTTP ${status}）。` }
}

export function createMealAiGateway({ apiKeys, endpoint, model, assignmentSecret, promptDirectory, fetchImpl = globalThis.fetch }) {
  const keyPool = [...new Set((apiKeys || []).map((key) => String(key).trim()).filter(Boolean))]
  let requestSequence = 0

  function getStatus() {
    return {
      serviceId: 'meal-ai',
      serviceName: '小饭 AI',
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
        const error = new Error('小饭 AI 返回了空内容，请重新提问。')
        error.code = 'empty_response'
        throw error
      }
      return content.slice(0, 12_000)
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('小饭 AI 响应超时，请稍后再试。')
        timeoutError.code = 'timeout'
        throw timeoutError
      }
      if (!error.code && /fetch|network|socket|ENOTFOUND|ECONN/i.test(String(error.message))) {
        error.message = '后台无法连接小饭 AI，请稍后再试。'
        error.code = 'network_error'
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async function requestWithAssignedKey(clientId, messages, options) {
    if (!keyPool.length) {
      const error = new Error('小饭 AI 后台通道尚未配置。')
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
    throw lastError || new Error('小饭 AI 后台通道暂时不可用。')
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
      serviceId: 'meal-ai',
      serviceName: '小饭 AI',
      requestId: `${Date.now().toString(36)}-${requestSequence.toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    }
  }

  async function testConnection(clientId) {
    try {
      await requestWithAssignedKey(clientId, [
        { role: 'system', content: '你是饮食助手连接检测程序。' },
        { role: 'user', content: '只回复四个字：连接成功' },
      ], { temperature: 0.1, maxTokens: 24, timeoutMs: 20_000 })
      return { ok: true, serviceId: 'meal-ai', serviceName: '小饭 AI' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '连接测试失败。', errorCode: error?.code || 'unknown_error' }
    }
  }

  return { chat, getStatus, testConnection }
}
