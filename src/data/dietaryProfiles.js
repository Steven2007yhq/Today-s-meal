const FAMILY_MEMBER_LIMIT = 8

export const FAMILY_AGE_OPTIONS = Object.freeze([
  '3–6 岁',
  '7–12 岁',
  '13–17 岁',
  '18–34 岁',
  '35–44 岁',
  '45–59 岁',
  '60 岁以上',
  '不愿透露',
])

export const ELDER_AGE_OPTIONS = Object.freeze([
  '60–69 岁',
  '70–79 岁',
  '80 岁以上',
  '不愿透露',
])

export const ELDER_CARE_GOALS = Object.freeze([
  { id: 'low-salt', label: '少盐清淡', shortLabel: '控盐' },
  { id: 'balanced-carb', label: '主食粗细搭配', shortLabel: '糖' },
  { id: 'calcium', label: '补钙与骨骼关怀', shortLabel: '钙' },
  { id: 'protein', label: '保证优质蛋白', shortLabel: '蛋白' },
  { id: 'soft-food', label: '软烂易嚼', shortLabel: '软' },
])

export const ELDER_CONDITIONS = Object.freeze([
  { id: 'hypertension', label: '高血压' },
  { id: 'diabetes', label: '糖尿病 / 血糖异常' },
  { id: 'hyperlipidemia', label: '高血脂' },
  { id: 'kidney', label: '肾功能相关疾病' },
  { id: 'gout', label: '痛风 / 高尿酸' },
  { id: 'osteoporosis', label: '骨质疏松' },
])

const FAMILY_DEFAULTS = Object.freeze([
  { id: 'family-1', role: '爸爸', icon: '👨🏻', ageGroup: '35–44 岁', portionMultiplier: 1.2, foodAvoidance: '' },
  { id: 'family-2', role: '妈妈', icon: '👩🏻', ageGroup: '35–44 岁', portionMultiplier: 1, foodAvoidance: '' },
  { id: 'family-3', role: '女儿', icon: '👧🏻', ageGroup: '7–12 岁', portionMultiplier: 0.7, foodAvoidance: '' },
  { id: 'family-4', role: '儿子', icon: '👦🏻', ageGroup: '3–6 岁', portionMultiplier: 0.5, foodAvoidance: '' },
])

const VALID_DISCLOSURES = new Set(['not_disclosed', 'none_known', 'shared'])
const VALID_CHEWING = new Set(['not_disclosed', 'normal', 'soft', 'very_soft'])
const VALID_SWALLOWING = new Set(['not_disclosed', 'normal', 'needs_attention'])

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function uniqueTextList(value, allowedValues, maximum = 12) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => allowedValues.has(item)))].slice(0, maximum)
}

export function createFamilyMember(index = 0) {
  return {
    id: `family-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    role: '家庭成员',
    icon: '🙂',
    ageGroup: '18–34 岁',
    portionMultiplier: 1,
    foodAvoidance: '',
  }
}

export function createDefaultFamilyProfile() {
  return {
    version: 1,
    completed: false,
    members: FAMILY_DEFAULTS.map((member) => ({ ...member })),
    sharedFoodAvoidance: '',
  }
}

function normalizeFamilyMember(member, index) {
  const fallback = createFamilyMember(index)
  return {
    id: cleanText(member?.id, 80) || fallback.id,
    role: cleanText(member?.role, 20) || '家庭成员',
    icon: cleanText(member?.icon, 8) || '🙂',
    ageGroup: FAMILY_AGE_OPTIONS.includes(member?.ageGroup) ? member.ageGroup : '不愿透露',
    portionMultiplier: Math.round(clampNumber(member?.portionMultiplier, 0.3, 2.5, 1) * 20) / 20,
    foodAvoidance: cleanText(member?.foodAvoidance, 120),
  }
}

export function normalizeFamilyProfile(profile) {
  const defaults = createDefaultFamilyProfile()
  const sourceMembers = Array.isArray(profile?.members) ? profile.members.slice(0, FAMILY_MEMBER_LIMIT) : defaults.members
  return {
    version: 1,
    completed: Boolean(profile?.completed),
    members: sourceMembers.map(normalizeFamilyMember),
    sharedFoodAvoidance: cleanText(profile?.sharedFoodAvoidance ?? profile?.allergies, 180),
  }
}

export function createDefaultElderProfile() {
  return {
    version: 1,
    completed: false,
    ageGroup: '不愿透露',
    chewing: 'not_disclosed',
    swallowing: 'not_disclosed',
    careGoals: ['low-salt', 'balanced-carb', 'calcium'],
    diseaseDisclosure: 'not_disclosed',
    conditions: [],
    otherCondition: '',
    medicationNote: '',
    foodAvoidance: '',
  }
}

export function normalizeElderProfile(profile) {
  const defaults = createDefaultElderProfile()
  const disclosure = VALID_DISCLOSURES.has(profile?.diseaseDisclosure) ? profile.diseaseDisclosure : defaults.diseaseDisclosure
  const allowedGoals = new Set(ELDER_CARE_GOALS.map((goal) => goal.id))
  const allowedConditions = new Set(ELDER_CONDITIONS.map((condition) => condition.id))
  return {
    version: 1,
    completed: Boolean(profile?.completed),
    ageGroup: ELDER_AGE_OPTIONS.includes(profile?.ageGroup) ? profile.ageGroup : defaults.ageGroup,
    chewing: VALID_CHEWING.has(profile?.chewing) ? profile.chewing : defaults.chewing,
    swallowing: VALID_SWALLOWING.has(profile?.swallowing) ? profile.swallowing : defaults.swallowing,
    careGoals: uniqueTextList(profile?.careGoals, allowedGoals, ELDER_CARE_GOALS.length),
    diseaseDisclosure: disclosure,
    conditions: disclosure === 'shared' ? uniqueTextList(profile?.conditions, allowedConditions, ELDER_CONDITIONS.length) : [],
    otherCondition: disclosure === 'shared' ? cleanText(profile?.otherCondition, 120) : '',
    medicationNote: cleanText(profile?.medicationNote, 160),
    foodAvoidance: cleanText(profile?.foodAvoidance, 160),
  }
}

export function familyProfileSummary(profile) {
  const normalized = normalizeFamilyProfile(profile)
  const avoidanceCount = normalized.members.filter((member) => member.foodAvoidance).length + (normalized.sharedFoodAvoidance ? 1 : 0)
  return {
    memberCount: normalized.members.length,
    avoidanceCount,
    totalPortions: Math.round(normalized.members.reduce((sum, member) => sum + member.portionMultiplier, 0) * 10) / 10,
  }
}

export function elderProfileSummary(profile) {
  const normalized = normalizeElderProfile(profile)
  const conditionCount = normalized.diseaseDisclosure === 'shared'
    ? normalized.conditions.length + (normalized.otherCondition ? 1 : 0)
    : 0
  return {
    goalCount: normalized.careGoals.length,
    conditionCount,
    diseaseLabel: normalized.diseaseDisclosure === 'not_disclosed'
      ? '不愿透露'
      : normalized.diseaseDisclosure === 'none_known'
        ? '暂无已知疾病'
        : conditionCount
          ? `已填写 ${conditionCount} 项`
          : '愿意填写',
  }
}

export function buildFamilyProfileContext(profile) {
  const normalized = normalizeFamilyProfile(profile)
  if (!normalized.completed) return null
  return {
    memberCount: normalized.members.length,
    members: normalized.members.map(({ role, ageGroup, portionMultiplier, foodAvoidance }) => ({
      role,
      ageGroup,
      portionMultiplier,
      foodAvoidance,
    })),
    sharedFoodAvoidance: normalized.sharedFoodAvoidance,
  }
}

export function buildElderProfileContext(profile) {
  const normalized = normalizeElderProfile(profile)
  if (!normalized.completed) return null
  const context = {
    ageGroup: normalized.ageGroup,
    chewing: normalized.chewing,
    swallowing: normalized.swallowing,
    careGoals: normalized.careGoals,
    diseaseDisclosure: normalized.diseaseDisclosure,
    medicationNote: normalized.medicationNote,
    foodAvoidance: normalized.foodAvoidance,
  }
  if (normalized.diseaseDisclosure === 'shared') {
    context.conditions = normalized.conditions
    context.otherCondition = normalized.otherCondition
  }
  return context
}
