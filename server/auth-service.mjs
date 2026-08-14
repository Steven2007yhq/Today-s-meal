import crypto from 'node:crypto'

const ALLOWED_EMAIL_DOMAINS = new Set(['163.com', '126.com', 'yeah.net', 'qq.com', 'foxmail.com'])
const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 72

function normalizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength)
}

export function normalizeAuthChannel(value) {
  const channel = normalizeText(value, 20).toLowerCase()
  return ['phone', 'email'].includes(channel) ? channel : ''
}

export function normalizeIdentifier(channel, value) {
  const normalizedChannel = normalizeAuthChannel(channel)
  if (normalizedChannel === 'phone') {
    const phone = String(value || '').replace(/\D/g, '')
    return /^1\d{10}$/.test(phone) ? phone : ''
  }
  if (normalizedChannel === 'email') {
    const email = normalizeText(value, 120).toLowerCase()
    const [, domain = ''] = email.split('@')
    return /^[^\s@]+@[^\s@]+$/.test(email) && ALLOWED_EMAIL_DOMAINS.has(domain) ? email : ''
  }
  return ''
}

export function providerForIdentifier(channel, identifier) {
  if (channel === 'phone') return 'phone'
  const domain = String(identifier).split('@')[1] || ''
  return domain === 'qq.com' || domain === 'foxmail.com' ? 'email_qq' : 'email_163'
}

export function maskIdentifier(channel, identifier) {
  if (channel === 'phone') return `${identifier.slice(0, 3)}****${identifier.slice(-4)}`
  const [localPart = '', domain = ''] = identifier.split('@')
  const maskedLocal = localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***`
  return `${maskedLocal}@${domain}`
}

export function validatePassword(password) {
  const normalized = String(password || '')
  if (normalized.length < PASSWORD_MIN_LENGTH) return '密码至少需要 6 位。'
  if (normalized.length > PASSWORD_MAX_LENGTH) return '密码不能超过 72 位。'
  return ''
}

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex')
}

export function hashIdentifier(identifier, secret) {
  return hmacHex(secret, identifier)
}

export function hashVerificationValue(value, secret) {
  return hmacHex(secret, value)
}

export function generateVerificationCode({ fixedCode = '', randomInt = crypto.randomInt } = {}) {
  if (/^\d{6}$/.test(String(fixedCode))) return String(fixedCode)
  return String(randomInt(100000, 1_000_000))
}

export function isValidCaptchaToken(value) {
  return /^[a-zA-Z0-9_-]{16,160}$/.test(String(value || ''))
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashSessionToken(token, secret) {
  return hmacHex(secret, token)
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, {
      N: 16_384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    }, (error, key) => (error ? reject(error) : resolve(key)))
  })
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derivedKey).toString('base64url')}`
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, nValue, rValue, pValue, saltValue, digestValue] = String(storedHash || '').split('$')
  if (algorithm !== 'scrypt' || !nValue || !rValue || !pValue || !saltValue || !digestValue) return false
  try {
    const salt = Buffer.from(saltValue, 'base64url')
    const expected = Buffer.from(digestValue, 'base64url')
    const actual = await new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, expected.length, {
        N: Number(nValue),
        r: Number(rValue),
        p: Number(pValue),
        maxmem: 64 * 1024 * 1024,
      }, (error, key) => (error ? reject(error) : resolve(key)))
    })
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function serializeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    gender: row.gender || '',
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginType: row.login_type || '',
    provider: row.provider || '',
    identifierHint: row.identifier_hint || '',
  }
}
