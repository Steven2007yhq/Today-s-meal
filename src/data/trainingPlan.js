export const FITNESS_WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const FITNESS_TRAINING_TYPES = [
  { id: 'push', group: '胸肩日', name: '推举训练', icon: '🏋🏻‍♂️', defaultDuration: 60, nutrition: '蛋白质 30–40g', focus: '胸肩力量与训练后恢复' },
  { id: 'pull', group: '背部日', name: '拉力训练', icon: '🧗🏻‍♂️', defaultDuration: 55, nutrition: '碳水 50–70g', focus: '背部训练容量与糖原补充' },
  { id: 'legs', group: '腿臀日', name: '腿臀力量', icon: '🏃🏻‍♂️', defaultDuration: 70, nutrition: '补水 2.2–2.8L', focus: '大肌群训练与电解质补充' },
  { id: 'core', group: '核心日', name: '核心稳定', icon: '🤸🏻‍♂️', defaultDuration: 35, nutrition: '轻负担餐', focus: '核心稳定与适量能量补给' },
  { id: 'arms', group: '手臂日', name: '手臂力量', icon: '💪🏻', defaultDuration: 45, nutrition: '蛋白质 25–35g', focus: '手臂力量与全天蛋白分配' },
  { id: 'hiit', group: '燃脂日', name: '间歇训练', icon: '⚡', defaultDuration: 30, nutrition: '训练前后补碳水', focus: '高强度间歇与快速恢复' },
  { id: 'running', group: '跑步日', name: '跑步训练', icon: '🏃', defaultDuration: 45, nutrition: '碳水 + 电解质', focus: '耐力跑、糖原与补液' },
  { id: 'cycling', group: '骑行日', name: '骑行训练', icon: '🚴', defaultDuration: 60, nutrition: '每小时补碳水', focus: '骑行耐力与分段补给' },
  { id: 'swimming', group: '游泳日', name: '游泳训练', icon: '🏊', defaultDuration: 45, nutrition: '训练后及时进餐', focus: '游泳恢复与体温消耗' },
  { id: 'mobility', group: '恢复日', name: '拉伸与瑜伽', icon: '🧘', defaultDuration: 30, nutrition: '均衡轻食', focus: '主动恢复与抗炎饮食' },
  { id: 'ball', group: '球类日', name: '球类运动', icon: '🏀', defaultDuration: 60, nutrition: '补水 + 快碳', focus: '间歇型球类运动与补液' },
  { id: 'rest', group: '休息日', name: '休息恢复', icon: '🌙', defaultDuration: 0, nutrition: '维持蛋白、适量减碳', focus: '休息日恢复与能量平衡' },
  { id: 'custom', group: '自定义', name: '自定义训练', icon: '✍🏻', defaultDuration: 45, nutrition: '由小饭按内容分析', focus: '用户自定义训练与个性化恢复' },
]

const DEFAULT_TYPE_IDS = ['push', 'pull', 'running', 'legs', 'core', 'mobility', 'rest']
const ALLOWED_INTENSITIES = new Set(['低', '中等', '高'])
const MAX_SESSIONS_PER_DAY = 6

export function getTrainingType(typeId) {
  return FITNESS_TRAINING_TYPES.find((item) => item.id === typeId) || FITNESS_TRAINING_TYPES.at(-1)
}

export function getFitnessWeekdayIndex(date = new Date()) {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function createSessionId(typeId, suffix = '') {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${typeId}-${suffix || randomPart}`
}

export function createFitnessTrainingSession(typeId = 'push', overrides = {}) {
  const type = getTrainingType(typeId)
  const rawDuration = Number(overrides.durationMinutes)
  return {
    id: String(overrides.id || createSessionId(type.id)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
    typeId: type.id,
    customName: type.id === 'custom' ? String(overrides.customName || '').replace(/\s+/g, ' ').trim().slice(0, 24) : '',
    durationMinutes: type.id === 'rest' ? 0 : Math.min(240, Math.max(10, Number.isFinite(rawDuration) ? Math.round(rawDuration) : type.defaultDuration)),
    intensity: type.id === 'rest' ? '低' : ALLOWED_INTENSITIES.has(overrides.intensity) ? overrides.intensity : '中等',
  }
}

export function createDefaultFitnessTrainingPlan() {
  return {
    version: 2,
    days: FITNESS_WEEK_DAYS.map((label, index) => {
      const type = getTrainingType(DEFAULT_TYPE_IDS[index])
      return {
        dayIndex: index,
        label,
        sessions: [createFitnessTrainingSession(type.id, {
          id: `${type.id}-${index + 1}`,
          intensity: type.id === 'rest' || type.id === 'mobility' ? '低' : type.id === 'legs' ? '高' : '中等',
        })],
      }
    }),
  }
}

function normalizeSession(session, dayIndex, sessionIndex) {
  const type = getTrainingType(session?.typeId)
  return createFitnessTrainingSession(type.id, {
    ...session,
    id: session?.id || `${type.id}-${dayIndex + 1}-${sessionIndex + 1}`,
  })
}

export function normalizeFitnessTrainingPlan(value) {
  const defaults = createDefaultFitnessTrainingPlan()
  const sourceDays = Array.isArray(value?.days) ? value.days : []
  return {
    version: 2,
    days: defaults.days.map((fallback, dayIndex) => {
      const source = sourceDays[dayIndex] && typeof sourceDays[dayIndex] === 'object' ? sourceDays[dayIndex] : fallback
      const legacySession = source.typeId ? [{
        id: `${source.typeId}-${dayIndex + 1}-legacy`,
        typeId: source.typeId,
        customName: source.customName,
        durationMinutes: source.durationMinutes,
        intensity: source.intensity,
      }] : []
      let sessions = (Array.isArray(source.sessions) ? source.sessions : legacySession)
        .slice(0, MAX_SESSIONS_PER_DAY)
        .map((session, sessionIndex) => normalizeSession(session, dayIndex, sessionIndex))
      const activeSessions = sessions.filter((session) => session.typeId !== 'rest')
      sessions = activeSessions.length ? activeSessions : sessions.filter((session) => session.typeId === 'rest').slice(0, 1)
      if (!sessions.length) sessions = [createFitnessTrainingSession('rest', { id: `rest-${dayIndex + 1}` })]
      return { dayIndex, label: FITNESS_WEEK_DAYS[dayIndex], sessions }
    }),
  }
}

export function addFitnessTrainingSession(plan, dayIndex, typeId = 'push') {
  const normalized = normalizeFitnessTrainingPlan(plan)
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return normalized
  const type = getTrainingType(typeId)
  const day = normalized.days[dayIndex]
  const sessions = type.id === 'rest'
    ? [createFitnessTrainingSession('rest')]
    : [...day.sessions.filter((session) => session.typeId !== 'rest'), createFitnessTrainingSession(type.id)].slice(0, MAX_SESSIONS_PER_DAY)
  return normalizeFitnessTrainingPlan({ ...normalized, days: normalized.days.map((item, index) => index === dayIndex ? { ...item, sessions } : item) })
}

export function updateFitnessTrainingSession(plan, dayIndex, sessionId, patch) {
  const normalized = normalizeFitnessTrainingPlan(plan)
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return normalized
  const day = normalized.days[dayIndex]
  const current = day.sessions.find((session) => session.id === sessionId)
  if (!current) return normalized
  const nextType = getTrainingType(patch.typeId ?? current.typeId)
  const typeChanged = nextType.id !== current.typeId
  const updated = createFitnessTrainingSession(nextType.id, {
    ...current,
    ...patch,
    id: current.id,
    customName: nextType.id === 'custom' ? patch.customName ?? current.customName : '',
    durationMinutes: patch.durationMinutes ?? (typeChanged ? nextType.defaultDuration : current.durationMinutes),
    intensity: patch.intensity ?? current.intensity,
  })
  const sessions = nextType.id === 'rest' ? [updated] : day.sessions.map((session) => session.id === sessionId ? updated : session).filter((session) => session.typeId !== 'rest')
  return normalizeFitnessTrainingPlan({ ...normalized, days: normalized.days.map((item, index) => index === dayIndex ? { ...item, sessions } : item) })
}

export function removeFitnessTrainingSession(plan, dayIndex, sessionId) {
  const normalized = normalizeFitnessTrainingPlan(plan)
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return normalized
  const day = normalized.days[dayIndex]
  const sessions = day.sessions.filter((session) => session.id !== sessionId)
  return normalizeFitnessTrainingPlan({ ...normalized, days: normalized.days.map((item, index) => index === dayIndex ? { ...item, sessions } : item) })
}

export function toggleFitnessTrainingType(plan, dayIndex, typeId) {
  const normalized = normalizeFitnessTrainingPlan(plan)
  const type = getTrainingType(typeId)
  const day = normalized.days[dayIndex]
  if (!day) return normalized
  if (type.id === 'rest') return normalizeFitnessTrainingPlan({ ...normalized, days: normalized.days.map((item, index) => index === dayIndex ? { ...item, sessions: [createFitnessTrainingSession('rest')] } : item) })
  const existing = day.sessions.find((session) => session.typeId === type.id)
  return existing ? removeFitnessTrainingSession(normalized, dayIndex, existing.id) : addFitnessTrainingSession(normalized, dayIndex, type.id)
}

function resolveSession(session) {
  const type = getTrainingType(session.typeId)
  return {
    ...session,
    typeName: type.name,
    displayName: type.id === 'custom' && session.customName ? session.customName : type.name,
    group: type.group,
    icon: type.icon,
    nutrition: type.nutrition,
    focus: type.focus,
  }
}

export function resolveFitnessTraining(plan, date = new Date()) {
  const normalized = normalizeFitnessTrainingPlan(plan)
  const day = normalized.days[getFitnessWeekdayIndex(date)]
  const sessions = day.sessions.map(resolveSession)
  const totalDurationMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0)
  const intensityRank = { 低: 1, 中等: 2, 高: 3 }
  const intensity = sessions.reduce((highest, session) => intensityRank[session.intensity] > intensityRank[highest] ? session.intensity : highest, '低')
  const isRestDay = sessions.every((session) => session.typeId === 'rest')
  return {
    ...day,
    sessions,
    activeTypeIds: [...new Set(sessions.map((session) => session.typeId))],
    totalDurationMinutes,
    durationMinutes: totalDurationMinutes,
    intensity,
    isRestDay,
    typeId: sessions.length === 1 ? sessions[0].typeId : 'multiple',
    displayName: sessions.map((session) => session.displayName).join(' + '),
    group: sessions.length === 1 ? sessions[0].group : `${sessions.length} 项训练`,
    nutrition: [...new Set(sessions.map((session) => session.nutrition))].join(' · '),
    focus: [...new Set(sessions.map((session) => session.focus))].join('；'),
  }
}

export function buildFitnessTrainingContext(plan, date = new Date()) {
  const normalized = normalizeFitnessTrainingPlan(plan)
  const todayIndex = getFitnessWeekdayIndex(date)
  const week = normalized.days.map((day) => {
    const sessions = day.sessions.map(resolveSession).map((session) => ({
      typeId: session.typeId,
      type: session.displayName,
      durationMinutes: session.durationMinutes,
      intensity: session.intensity,
      focus: session.focus,
    }))
    return {
      day: day.label,
      sessions,
      totalDurationMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    }
  })
  return { today: week[todayIndex], week }
}
