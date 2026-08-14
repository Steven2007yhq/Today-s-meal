import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import sharp from 'sharp'
import { config } from './config.mjs'
import { assertStartupConfig } from './validate-config.mjs'
import { pool, withTransaction } from './db.mjs'
import { ensureImageBucket, getSignedImageUrl, putImage } from './storage.mjs'
import { createMealAiGateway, normalizeClientId } from './ai-service.mjs'
import { BillingError, createBillingService } from './billing-service.mjs'
import { createPaymentProviderGateway } from './payment-providers.mjs'
import {
  createSessionToken,
  generateVerificationCode,
  hashIdentifier,
  hashPassword,
  hashSessionToken,
  hashVerificationValue,
  isValidCaptchaToken,
  maskIdentifier,
  normalizeAuthChannel,
  normalizeIdentifier,
  providerForIdentifier,
  serializeUser,
  validatePassword,
  verifyPassword,
} from './auth-service.mjs'

// Fail closed before anything opens a socket or a database connection.
try {
  assertStartupConfig(config)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const app = express()
const promptDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prompts')
const aiGateway = createMealAiGateway({ ...config.ai, promptDirectory })
const paymentGateway = createPaymentProviderGateway(config.billing)
const billingService = createBillingService({
  pool,
  withTransaction,
  paymentGateway,
  orderTtlMinutes: config.billing.orderTtlMinutes,
})
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
})

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Billing-Admin-Token', 'X-Meal-Client-Id', 'X-Meal-Owner-Key'],
}))
function captureRawBody(request, _response, buffer) {
  request.rawBody = buffer.toString('utf8')
}
app.use(express.json({ limit: '128kb', verify: captureRawBody }))
app.use(express.urlencoded({ extended: false, limit: '64kb', verify: captureRawBody }))

function requireUploadToken(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const expectedBuffer = Buffer.from(config.uploadToken)
  const tokenBuffer = Buffer.from(token || '')
  if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    response.status(401).json({ error: 'invalid_upload_token' })
    return
  }
  next()
}

function requireBillingAdminToken(request, response, next) {
  const token = String(request.headers['x-billing-admin-token'] || '')
  const expectedBuffer = Buffer.from(config.billing.adminToken)
  const tokenBuffer = Buffer.from(token)
  if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    response.status(401).json({ error: 'invalid_billing_admin_token', message: '账单管理授权失败。' })
    return
  }
  next()
}

function requireAiGatewayToken(request, response, next) {
  if (!config.ai.gatewayToken) {
    next()
    return
  }
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const expectedBuffer = Buffer.from(config.ai.gatewayToken)
  const tokenBuffer = Buffer.from(token || '')
  if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    response.status(401).json({ error: 'invalid_ai_gateway_token', message: 'AI 网关授权失败。' })
    return
  }
  next()
}

function requireAiClientId(request, response, next) {
  const clientId = normalizeClientId(request.headers['x-meal-client-id'])
  if (!clientId) {
    response.status(400).json({ error: 'invalid_ai_client_id', message: '客户端身份无效。' })
    return
  }
  request.aiClientId = clientId
  next()
}

function isValidDishId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,99}$/.test(value)
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeFavoriteOwnerKey(value) {
  const normalizedValue = Array.isArray(value) ? value[0] : value
  const ownerKey = String(normalizedValue || '').trim()
  return /^[a-z0-9][a-z0-9_-]{7,127}$/i.test(ownerKey) ? ownerKey : ''
}

function getFavoriteOwnerKeyHash(request) {
  const ownerKey = normalizeFavoriteOwnerKey(request.headers['x-meal-owner-key'] || request.query.ownerKey || request.body?.ownerKey)
  return ownerKey ? crypto.createHash('sha256').update(ownerKey).digest('hex') : ''
}

function getBearerToken(request) {
  const authorization = String(request.headers.authorization || '')
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  return token && /^[a-zA-Z0-9_-]{32,200}$/.test(token) ? token : ''
}

function normalizeAuthPurpose(value) {
  const purpose = String(value || '').trim().toLowerCase()
  return ['register', 'login', 'reset_password'].includes(purpose) ? purpose : ''
}

function respondAuthError(response, status, error, message) {
  response.status(status).json({ error, message })
}

async function consumeVerificationChallenge(client, {
  subjectHash,
  purpose,
  code,
  captchaToken,
}) {
  const result = await client.query(
    `SELECT id, code_hash, captcha_token_hash, attempts, expires_at
     FROM identity.verification_challenges
     WHERE subject_hash = $1
       AND purpose = $2
       AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [subjectHash, purpose],
  )
  const challenge = result.rows[0]
  if (!challenge) return { ok: false, error: 'verification_required', message: '验证码已失效，请重新获取。' }
  if (Number(challenge.attempts) >= 5) return { ok: false, error: 'verification_locked', message: '验证码尝试次数过多，请重新获取。' }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: 'verification_expired', message: '验证码已过期，请重新获取。' }
  }
  const codeHash = hashVerificationValue(code, config.auth.secret)
  const captchaHash = hashVerificationValue(captchaToken, config.auth.secret)
  if (challenge.code_hash !== codeHash || challenge.captcha_token_hash !== captchaHash) {
    await client.query(
      'UPDATE identity.verification_challenges SET attempts = attempts + 1 WHERE id = $1',
      [challenge.id],
    )
    return { ok: false, error: 'verification_invalid', message: '验证码或滑块验证不正确。' }
  }
  await client.query(
    'UPDATE identity.verification_challenges SET consumed_at = now() WHERE id = $1',
    [challenge.id],
  )
  return { ok: true }
}

async function createAuthSession(client, userId, request) {
  const token = createSessionToken()
  const tokenHash = hashSessionToken(token, config.auth.secret)
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlSeconds * 1_000)
  await client.query(
    `INSERT INTO identity.sessions
       (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, NULLIF($5, '')::inet)`,
    [
      userId,
      tokenHash,
      expiresAt,
      String(request.headers['user-agent'] || '').slice(0, 500),
      String(request.ip || '').replace(/^::ffff:/, ''),
    ],
  )
  return { token, expiresAt: expiresAt.toISOString() }
}

async function readAuthSession(request) {
  const token = getBearerToken(request)
  if (!token) return null
  const tokenHash = hashSessionToken(token, config.auth.secret)
  const result = await pool.query(
    `SELECT session.id AS session_id,
            user_row.id,
            user_row.display_name,
            user_row.avatar_url,
            user_row.gender,
            user_row.status,
            user_row.created_at,
            user_row.last_login_at,
            identity.provider,
            identity.identifier_hint,
            session.expires_at
     FROM identity.sessions session
     JOIN identity.users user_row ON user_row.id = session.user_id
     LEFT JOIN LATERAL (
       SELECT provider, identifier_hint
       FROM identity.login_identities
       WHERE user_id = user_row.id
       ORDER BY verified_at ASC
       LIMIT 1
     ) identity ON true
     WHERE session.token_hash = $1
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND user_row.status = 'active'
     LIMIT 1`,
    [tokenHash],
  )
  if (!result.rowCount) return null
  await pool.query('UPDATE identity.sessions SET last_seen_at = now() WHERE id = $1', [result.rows[0].session_id])
  return {
    token,
    expiresAt: result.rows[0].expires_at,
    user: serializeUser(result.rows[0]),
  }
}

async function requireAuthSession(request, response, next) {
  try {
    const session = await readAuthSession(request)
    if (!session) {
      respondAuthError(response, 401, 'session_invalid', '登录状态已失效，请重新登录。')
      return
    }
    request.authSession = session
    next()
  } catch (error) {
    next(error)
  }
}

function requireFavoriteOwnerKey(request, response) {
  const ownerKeyHash = getFavoriteOwnerKeyHash(request)
  if (!ownerKeyHash) {
    response.status(400).json({ error: 'invalid_favorite_owner_key', message: '收藏用户标识无效。' })
    return ''
  }
  return ownerKeyHash
}

function sanitizeFavoriteCollectionName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function sanitizeFavoriteCollectionColor(value) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#e96f45'
}

async function serializeImage(row) {
  return {
    id: row.id,
    dishId: row.dish_id,
    url: await getSignedImageUrl(row.object_key),
    thumbnailUrl: await getSignedImageUrl(row.thumbnail_key),
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    sourceUrl: row.source_url,
    licenseType: row.license_type,
    attribution: row.attribution,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}

async function ensureDefaultFavoriteCollection(client, ownerKeyHash) {
  const result = await client.query(
    `INSERT INTO meal.favorite_collections (owner_key_hash, name, color, is_default)
     VALUES ($1, '默认收藏', '#e96f45', true)
     ON CONFLICT (owner_key_hash, name)
     DO UPDATE SET is_default = true, updated_at = now()
     RETURNING id, name, color, is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [ownerKeyHash],
  )
  return result.rows[0]
}

async function readFavoriteState(client, ownerKeyHash) {
  await ensureDefaultFavoriteCollection(client, ownerKeyHash)
  const collectionsResult = await client.query(
    `SELECT collection.id, collection.name, collection.color,
            collection.is_default AS "isDefault",
            collection.created_at AS "createdAt",
            collection.updated_at AS "updatedAt",
            COUNT(favorite.id)::integer AS "dishCount"
     FROM meal.favorite_collections collection
     LEFT JOIN meal.favorite_dishes favorite
       ON favorite.collection_id = collection.id
      AND favorite.owner_key_hash = collection.owner_key_hash
     WHERE collection.owner_key_hash = $1
     GROUP BY collection.id
     ORDER BY collection.is_default DESC, collection.created_at ASC`,
    [ownerKeyHash],
  )
  const favoritesResult = await client.query(
    `SELECT favorite.id,
            favorite.dish_id AS "dishId",
            favorite.collection_id AS "collectionId",
            collection.name AS "collectionName",
            collection.color AS "collectionColor",
            collection.is_default AS "isDefaultCollection",
            favorite.note,
            favorite.sort_order AS "sortOrder",
            favorite.created_at AS "createdAt",
            favorite.updated_at AS "updatedAt",
            dish.name,
            dish.cuisine,
            dish.method,
            dish.taste,
            dish.ingredients,
            dish.nutrition,
            dish.tags,
            dish.source
     FROM meal.favorite_dishes favorite
     JOIN meal.favorite_collections collection ON collection.id = favorite.collection_id
     JOIN catalog.dishes dish ON dish.id = favorite.dish_id
     WHERE favorite.owner_key_hash = $1
     ORDER BY favorite.created_at DESC`,
    [ownerKeyHash],
  )
  const collections = collectionsResult.rows.map((collection) => ({ ...collection, dishCount: Number(collection.dishCount || 0) }))
  return {
    collections,
    favorites: favoritesResult.rows,
    activeCollectionId: collections.find((collection) => collection.isDefault)?.id || collections[0]?.id || '',
  }
}

app.get('/health', async (_request, response, next) => {
  try {
    await Promise.all([pool.query('SELECT 1'), ensureImageBucket()])
    response.json({ status: 'ok', postgres: 'ready', minio: 'ready' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/send-code', async (request, response, next) => {
  try {
    const channel = normalizeAuthChannel(request.body?.channel)
    const identifier = normalizeIdentifier(channel, request.body?.identifier)
    const purpose = normalizeAuthPurpose(request.body?.purpose || 'register')
    const captchaToken = String(request.body?.captchaToken || '').trim()
    if (!channel || !identifier) {
      respondAuthError(response, 400, 'invalid_identifier', '请输入有效的手机号，或 163/QQ 邮箱。')
      return
    }
    if (!purpose) {
      respondAuthError(response, 400, 'invalid_verification_purpose', '验证码用途无效。')
      return
    }
    if (!isValidCaptchaToken(captchaToken)) {
      respondAuthError(response, 400, 'captcha_required', '请先完成滑块验证。')
      return
    }
    const subjectHash = hashIdentifier(identifier, config.auth.secret)
    const code = generateVerificationCode({
      fixedCode: config.auth.exposeDevCode ? config.auth.devCode : '',
    })
    const result = await withTransaction(async (client) => {
      const recentResult = await client.query(
        `SELECT created_at
         FROM identity.verification_challenges
         WHERE subject_hash = $1 AND purpose = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [subjectHash, purpose],
      )
      const recentCreatedAt = recentResult.rows[0]?.created_at
      if (recentCreatedAt) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(recentCreatedAt).getTime()) / 1_000)
        if (elapsedSeconds < config.auth.verificationCooldownSeconds) {
          return { cooldown: true, retryAfter: config.auth.verificationCooldownSeconds - elapsedSeconds }
        }
      }
      await client.query(
        `UPDATE identity.verification_challenges
         SET consumed_at = now()
         WHERE subject_hash = $1 AND purpose = $2 AND consumed_at IS NULL`,
        [subjectHash, purpose],
      )
      await client.query(
        `INSERT INTO identity.verification_challenges
          (subject_hash, purpose, code_hash, captcha_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 second'))`,
        [
          subjectHash,
          purpose,
          hashVerificationValue(code, config.auth.secret),
          hashVerificationValue(captchaToken, config.auth.secret),
          config.auth.verificationTtlSeconds,
        ],
      )
      return { cooldown: false, retryAfter: config.auth.verificationCooldownSeconds }
    })
    if (result.cooldown) {
      response.status(429).json({
        error: 'verification_rate_limited',
        message: `验证码刚发过，请 ${result.retryAfter} 秒后再试。`,
        retryAfter: result.retryAfter,
      })
      return
    }
    console.info(`[auth] ${channel} ${maskIdentifier(channel, identifier)} ${purpose} verification code: ${config.auth.exposeDevCode ? code : '[provider]'} `)
    const payload = {
      sent: true,
      channel,
      purpose,
      expiresIn: config.auth.verificationTtlSeconds,
      retryAfter: config.auth.verificationCooldownSeconds,
      message: config.auth.exposeDevCode ? '开发环境验证码已生成。' : '验证码发送请求已创建。',
    }
    if (config.auth.exposeDevCode) payload.devCode = code
    response.json(payload)
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const channel = normalizeAuthChannel(request.body?.channel)
    const identifier = normalizeIdentifier(channel, request.body?.identifier)
    const password = String(request.body?.password || '')
    const code = String(request.body?.code || '').trim()
    const captchaToken = String(request.body?.captchaToken || '').trim()
    const displayName = String(request.body?.displayName || '').replace(/\s+/g, ' ').trim().slice(0, 40) || '小饭同学'
    const passwordError = validatePassword(password)
    if (!channel || !identifier) {
      respondAuthError(response, 400, 'invalid_identifier', '请输入有效的手机号，或 163/QQ 邮箱。')
      return
    }
    if (passwordError) {
      respondAuthError(response, 400, 'invalid_password', passwordError)
      return
    }
    if (!/^\d{6}$/.test(code) || !isValidCaptchaToken(captchaToken)) {
      respondAuthError(response, 400, 'verification_required', '请先获取验证码并完成滑块验证。')
      return
    }
    const provider = providerForIdentifier(channel, identifier)
    const subjectHash = hashIdentifier(identifier, config.auth.secret)
    const passwordHash = await hashPassword(password)
    const result = await withTransaction(async (client) => {
      const verification = await consumeVerificationChallenge(client, {
        subjectHash,
        purpose: 'register',
        code,
        captchaToken,
      })
      if (!verification.ok) return verification
      const existingIdentity = await client.query(
        `SELECT user_id
         FROM identity.login_identities
         WHERE provider = $1 AND provider_subject_hash = $2
         LIMIT 1`,
        [provider, subjectHash],
      )
      if (existingIdentity.rowCount) {
        return { ok: false, error: 'account_exists', message: '这个账号已经注册过了，直接登录就好。' }
      }
      const userResult = await client.query(
        `INSERT INTO identity.users (display_name, password_hash)
         VALUES ($1, $2)
         RETURNING id, display_name, avatar_url, gender, status, created_at, last_login_at`,
        [displayName, passwordHash],
      )
      const user = userResult.rows[0]
      await client.query(
        `INSERT INTO identity.login_identities
          (user_id, provider, provider_subject_hash, identifier_hint)
         VALUES ($1, $2, $3, $4)`,
        [user.id, provider, subjectHash, maskIdentifier(channel, identifier)],
      )
      const session = await createAuthSession(client, user.id, request)
      return {
        ok: true,
        session,
        user: serializeUser({
          ...user,
          provider,
          identifier_hint: maskIdentifier(channel, identifier),
          login_type: channel,
        }),
      }
    })
    if (!result.ok) {
      respondAuthError(response, result.error === 'account_exists' ? 409 : 400, result.error, result.message)
      return
    }
    response.status(201).json({ user: result.user, session: result.session })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const channel = normalizeAuthChannel(request.body?.channel)
    const identifier = normalizeIdentifier(channel, request.body?.identifier)
    const password = String(request.body?.password || '')
    const code = String(request.body?.code || '').trim()
    const captchaToken = String(request.body?.captchaToken || '').trim()
    const passwordError = validatePassword(password)
    if (!channel || !identifier) {
      respondAuthError(response, 400, 'invalid_identifier', '请输入有效的手机号，或 163/QQ 邮箱。')
      return
    }
    if (passwordError) {
      respondAuthError(response, 400, 'invalid_password', passwordError)
      return
    }
    if (!isValidCaptchaToken(captchaToken)) {
      respondAuthError(response, 400, 'captcha_required', '请先完成滑块验证。')
      return
    }
    const provider = providerForIdentifier(channel, identifier)
    const subjectHash = hashIdentifier(identifier, config.auth.secret)
    const result = await withTransaction(async (client) => {
      const accountResult = await client.query(
        `SELECT user_row.id,
                user_row.display_name,
                user_row.avatar_url,
                user_row.gender,
                user_row.password_hash,
                user_row.status,
                user_row.created_at,
                user_row.last_login_at,
                identity.provider,
                identity.identifier_hint
         FROM identity.login_identities identity
         JOIN identity.users user_row ON user_row.id = identity.user_id
         WHERE identity.provider = $1
           AND identity.provider_subject_hash = $2
         LIMIT 1
         FOR UPDATE`,
        [provider, subjectHash],
      )
      if (!accountResult.rowCount) {
        return { ok: false, error: 'not_registered', message: '这个账号还没有注册，先点下方“点我注册”吧。' }
      }
      const account = accountResult.rows[0]
      if (account.status !== 'active') {
        return { ok: false, error: 'account_unavailable', message: '这个账号当前不可登录，请联系平台管理员。' }
      }
      if (!(await verifyPassword(password, account.password_hash))) {
        return { ok: false, error: 'invalid_credentials', message: '账号或密码不正确。' }
      }
      if (code) {
        if (!/^\d{6}$/.test(code)) {
          return { ok: false, error: 'verification_invalid', message: '验证码格式不正确。' }
        }
        const verification = await consumeVerificationChallenge(client, {
          subjectHash,
          purpose: 'login',
          code,
          captchaToken,
        })
        if (!verification.ok) return verification
      }
      await client.query('UPDATE identity.users SET last_login_at = now() WHERE id = $1', [account.id])
      const session = await createAuthSession(client, account.id, request)
      return {
        ok: true,
        session,
        user: serializeUser({
          ...account,
          last_login_at: new Date().toISOString(),
          login_type: channel,
        }),
      }
    })
    if (!result.ok) {
      const status = result.error === 'not_registered' ? 404 : result.error === 'invalid_credentials' ? 401 : 400
      respondAuthError(response, status, result.error, result.message)
      return
    }
    response.json({ user: result.user, session: result.session })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', async (request, response, next) => {
  try {
    const session = await readAuthSession(request)
    if (!session) {
      respondAuthError(response, 401, 'session_invalid', '登录状态已失效，请重新登录。')
      return
    }
    response.json({ user: session.user, session: { expiresAt: session.expiresAt } })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', async (request, response, next) => {
  try {
    const token = getBearerToken(request)
    if (token) {
      await pool.query(
        'UPDATE identity.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [hashSessionToken(token, config.auth.secret)],
      )
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/oauth/:provider/start', async (request, response) => {
  const provider = String(request.params.provider || '').trim().toLowerCase()
  if (!['wechat', 'qq'].includes(provider)) {
    respondAuthError(response, 400, 'invalid_oauth_provider', '暂不支持这个第三方登录。')
    return
  }
  const appId = provider === 'wechat' ? config.auth.wechatAppId : config.auth.qqAppId
  const redirectUri = provider === 'wechat' ? config.auth.wechatRedirectUri : config.auth.qqRedirectUri
  if (!appId || !redirectUri) {
    response.status(501).json({
      configured: false,
      provider,
      error: 'oauth_not_configured',
      message: `${provider === 'wechat' ? '微信' : 'QQ'}登录需要先在后台配置 OAuth AppID 和回调地址。`,
    })
    return
  }
  const state = crypto.randomBytes(18).toString('base64url')
  const encodedRedirectUri = encodeURIComponent(redirectUri)
  const authorizationUrl = provider === 'wechat'
    ? `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appId)}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`
    : `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(appId)}&redirect_uri=${encodedRedirectUri}&state=${encodeURIComponent(state)}`
  response.json({ configured: true, provider, authorizationUrl, state })
})

app.get('/api/billing/products', async (_request, response, next) => {
  try {
    response.json(await billingService.listProducts())
  } catch (error) {
    next(error)
  }
})

app.get('/api/membership/me', requireAuthSession, async (request, response, next) => {
  try {
    response.json({ membership: await billingService.readMembership(request.authSession.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/billing/orders', requireAuthSession, async (request, response, next) => {
  try {
    const result = await billingService.createOrder({
      userId: request.authSession.user.id,
      productCode: String(request.body?.productCode || '').trim(),
      provider: String(request.body?.provider || '').trim().toLowerCase(),
      idempotencyKey: String(request.headers['idempotency-key'] || '').trim(),
    })
    response.status(result.reused ? 200 : 201).json(result)
  } catch (error) {
    next(error)
  }
})

app.get('/api/billing/orders/:orderId', requireAuthSession, async (request, response, next) => {
  try {
    if (!isUuid(request.params.orderId)) throw new BillingError('invalid_order_id', '订单编号无效。')
    response.json(await billingService.readOrder(request.authSession.user.id, request.params.orderId))
  } catch (error) {
    next(error)
  }
})

app.get('/api/billing/orders', requireAuthSession, async (request, response, next) => {
  try {
    response.json(await billingService.listOrders(request.authSession.user.id, request.query.limit))
  } catch (error) {
    next(error)
  }
})

app.post('/api/billing/orders/:orderId/reconcile', requireAuthSession, async (request, response, next) => {
  try {
    if (!isUuid(request.params.orderId)) throw new BillingError('invalid_order_id', '订单编号无效。')
    response.json(await billingService.reconcileOrder(request.authSession.user.id, request.params.orderId))
  } catch (error) {
    next(error)
  }
})

app.post('/api/billing/admin/orders/:orderId/refund', requireBillingAdminToken, async (request, response, next) => {
  try {
    if (!isUuid(request.params.orderId)) throw new BillingError('invalid_order_id', '订单编号无效。')
    response.json(await billingService.recordRefund(request.params.orderId, request.body?.reason))
  } catch (error) {
    next(error)
  }
})

app.post('/api/billing/dev/orders/:orderId/complete', requireAuthSession, async (request, response, next) => {
  try {
    if (!isUuid(request.params.orderId)) throw new BillingError('invalid_order_id', '订单编号无效。')
    response.json(await billingService.completeDevelopmentOrder(request.authSession.user.id, request.params.orderId))
  } catch (error) {
    next(error)
  }
})

app.post('/api/billing/webhooks/wechat', async (request, response) => {
  try {
    const result = await billingService.handleNotification('wechat', {
      headers: request.headers,
      rawBody: request.rawBody || '',
      body: request.body,
    })
    if (!result.accepted) {
      response.status(409).json({ code: 'FAIL', message: result.message || result.code || '订单校验失败' })
      return
    }
    response.json({ code: 'SUCCESS', message: '成功' })
  } catch (error) {
    console.warn('[billing] WeChat notification rejected:', error.message)
    response.status(error.status || 401).json({ code: 'FAIL', message: '支付通知校验失败' })
  }
})

app.post('/api/billing/webhooks/alipay', async (request, response) => {
  try {
    const result = await billingService.handleNotification('alipay', {
      headers: request.headers,
      rawBody: request.rawBody || '',
      body: request.body,
    })
    if (!result.accepted) {
      response.status(409).type('text/plain').send('failure')
      return
    }
    response.type('text/plain').send('success')
  } catch (error) {
    console.warn('[billing] Alipay notification rejected:', error.message)
    response.status(error.status || 401).type('text/plain').send('failure')
  }
})

app.get('/api/ai/status', requireAiGatewayToken, (_request, response) => {
  response.json(aiGateway.getStatus())
})

app.post('/api/ai/chat', requireAiGatewayToken, requireAiClientId, async (request, response, next) => {
  try {
    if (!aiGateway.getStatus().ready) {
      response.status(503).json({ error: 'ai_key_pool_unconfigured', message: '小饭 AI 后台通道尚未配置。' })
      return
    }
    response.json(await aiGateway.chat(request.body, request.aiClientId))
  } catch (error) {
    if (error?.code) {
      response.status(error.code === 'rate_limited' ? 429 : 502).json({ error: error.code, message: error.message })
      return
    }
    next(error)
  }
})

app.post('/api/ai/test', requireAiGatewayToken, requireAiClientId, async (request, response) => {
  const result = await aiGateway.testConnection(request.aiClientId)
  response.status(result.ok ? 200 : 503).json(result)
})

app.get('/api/images', async (request, response, next) => {
  try {
    const dishIds = String(request.query.dishIds || '').split(',').map((value) => value.trim()).filter(isValidDishId).slice(0, 50)
    if (!dishIds.length) {
      response.json({ images: [] })
      return
    }
    const result = await pool.query(
      `SELECT DISTINCT ON (dish_id) *
       FROM media.dish_images
       WHERE dish_id = ANY($1::varchar[]) AND deleted_at IS NULL
       ORDER BY dish_id, created_at DESC`,
      [dishIds],
    )
    response.json({ images: await Promise.all(result.rows.map(serializeImage)) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/dishes/:dishId/images', async (request, response, next) => {
  try {
    if (!isValidDishId(request.params.dishId)) {
      response.status(400).json({ error: 'invalid_dish_id' })
      return
    }
    const result = await pool.query(
      `SELECT * FROM media.dish_images
       WHERE dish_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [request.params.dishId],
    )
    response.json({ images: await Promise.all(result.rows.map(serializeImage)) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/catalog/dishes', async (request, response, next) => {
  try {
    const cuisine = String(request.query.cuisine || '').trim().slice(0, 40)
    const search = String(request.query.search || '').trim().slice(0, 80)
    const result = await pool.query(
      `SELECT id, name, cuisine, method, taste, ingredients, nutrition, tags, source, updated_at
       FROM catalog.dishes
       WHERE ($1 = '' OR cuisine = $1)
         AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR ingredients::text ILIKE '%' || $2 || '%')
       ORDER BY cuisine, name
       LIMIT 300`,
      [cuisine, search],
    )
    response.json({ dishes: result.rows })
  } catch (error) {
    next(error)
  }
})

app.get('/api/catalog/dishes/:dishId/relations', async (request, response, next) => {
  try {
    if (!isValidDishId(request.params.dishId)) {
      response.status(400).json({ error: 'invalid_dish_id' })
      return
    }
    const result = await pool.query(
      `SELECT relation.target_id AS "dishId", relation.score, relation.reason,
              dish.name, dish.cuisine, dish.method
       FROM catalog.dish_relations relation
       JOIN catalog.dishes dish ON dish.id = relation.target_id
       WHERE relation.source_id = $1
       ORDER BY relation.score DESC
       LIMIT 20`,
      [request.params.dishId],
    )
    response.json({ relations: result.rows })
  } catch (error) {
    next(error)
  }
})

app.get('/api/favorites', async (request, response, next) => {
  try {
    const ownerKeyHash = requireFavoriteOwnerKey(request, response)
    if (!ownerKeyHash) return
    const state = await withTransaction((client) => readFavoriteState(client, ownerKeyHash))
    response.json(state)
  } catch (error) {
    next(error)
  }
})

app.post('/api/favorites/collections', async (request, response, next) => {
  try {
    const ownerKeyHash = requireFavoriteOwnerKey(request, response)
    if (!ownerKeyHash) return
    const name = sanitizeFavoriteCollectionName(request.body?.name)
    const color = sanitizeFavoriteCollectionColor(request.body?.color)
    if (!name) {
      response.status(400).json({ error: 'invalid_collection_name', message: '收藏夹名称不能为空。' })
      return
    }
    const collection = await withTransaction(async (client) => {
      await ensureDefaultFavoriteCollection(client, ownerKeyHash)
      const result = await client.query(
        `INSERT INTO meal.favorite_collections (owner_key_hash, name, color, is_default)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (owner_key_hash, name)
         DO UPDATE SET color = EXCLUDED.color, updated_at = now()
         RETURNING id, name, color, is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [ownerKeyHash, name, color],
      )
      return result.rows[0]
    })
    response.status(201).json({ collection })
  } catch (error) {
    next(error)
  }
})

app.post('/api/favorites', async (request, response, next) => {
  try {
    const ownerKeyHash = requireFavoriteOwnerKey(request, response)
    if (!ownerKeyHash) return
    const dishId = String(request.body?.dishId || '').trim()
    if (!isValidDishId(dishId)) {
      response.status(400).json({ error: 'invalid_dish_id' })
      return
    }
    const dishExists = await pool.query('SELECT id FROM catalog.dishes WHERE id = $1 LIMIT 1', [dishId])
    if (!dishExists.rowCount) {
      response.status(404).json({ error: 'dish_not_found', message: '收藏失败，这道菜还没有入库。' })
      return
    }
    const requestedCollectionId = String(request.body?.collectionId || '').trim()
    const note = String(request.body?.note || '').trim().slice(0, 160)
    const favorite = await withTransaction(async (client) => {
      const defaultCollection = await ensureDefaultFavoriteCollection(client, ownerKeyHash)
      let targetCollection = defaultCollection
      if (isUuid(requestedCollectionId)) {
        const collectionResult = await client.query(
          `SELECT id, name, color, is_default AS "isDefault"
           FROM meal.favorite_collections
           WHERE id = $1 AND owner_key_hash = $2
           LIMIT 1`,
          [requestedCollectionId, ownerKeyHash],
        )
        if (collectionResult.rowCount) targetCollection = collectionResult.rows[0]
      }
      const upsertResult = await client.query(
        `INSERT INTO meal.favorite_dishes (owner_key_hash, collection_id, dish_id, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (owner_key_hash, dish_id)
         DO UPDATE SET collection_id = EXCLUDED.collection_id, note = EXCLUDED.note, updated_at = now()
         RETURNING id`,
        [ownerKeyHash, targetCollection.id, dishId, note],
      )
      const favoriteResult = await client.query(
        `SELECT favorite.id,
                favorite.dish_id AS "dishId",
                favorite.collection_id AS "collectionId",
                collection.name AS "collectionName",
                collection.color AS "collectionColor",
                collection.is_default AS "isDefaultCollection",
                favorite.note,
                favorite.sort_order AS "sortOrder",
                favorite.created_at AS "createdAt",
                favorite.updated_at AS "updatedAt",
                dish.name,
                dish.cuisine,
                dish.method,
                dish.taste,
                dish.ingredients,
                dish.nutrition,
                dish.tags,
                dish.source
         FROM meal.favorite_dishes favorite
         JOIN meal.favorite_collections collection ON collection.id = favorite.collection_id
         JOIN catalog.dishes dish ON dish.id = favorite.dish_id
         WHERE favorite.id = $1`,
        [upsertResult.rows[0].id],
      )
      return favoriteResult.rows[0]
    })
    response.status(201).json({ favorite })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/favorites/:dishId', async (request, response, next) => {
  try {
    const ownerKeyHash = requireFavoriteOwnerKey(request, response)
    if (!ownerKeyHash) return
    if (!isValidDishId(request.params.dishId)) {
      response.status(400).json({ error: 'invalid_dish_id' })
      return
    }
    const result = await pool.query(
      'DELETE FROM meal.favorite_dishes WHERE owner_key_hash = $1 AND dish_id = $2 RETURNING id',
      [ownerKeyHash, request.params.dishId],
    )
    if (!result.rowCount) {
      response.status(404).json({ error: 'favorite_not_found' })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.post('/api/images', requireUploadToken, upload.single('image'), async (request, response, next) => {
  try {
    const { dishId, sourceUrl = '', licenseType, attribution = '', originalFileName = '', collection = '' } = request.body
    if (!isValidDishId(dishId)) {
      response.status(400).json({ error: 'invalid_dish_id' })
      return
    }
    if (!request.file || !licenseType) {
      response.status(400).json({ error: 'image_and_license_type_are_required' })
      return
    }

    const metadata = await sharp(request.file.buffer).metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height) {
      response.status(415).json({ error: 'unsupported_image_type' })
      return
    }

    const sha256 = crypto.createHash('sha256').update(request.file.buffer).digest('hex')
    const existing = await pool.query(
      'SELECT * FROM media.dish_images WHERE dish_id = $1 AND sha256 = $2 AND deleted_at IS NULL LIMIT 1',
      [dishId, sha256],
    )
    if (existing.rowCount) {
      response.status(200).json({ image: await serializeImage(existing.rows[0]), deduplicated: true })
      return
    }

    const normalizedImage = await sharp(request.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toBuffer({ resolveWithObject: true })
    const thumbnail = await sharp(request.file.buffer)
      .rotate()
      .resize({ width: 480, height: 360, fit: 'cover', position: 'attention' })
      .webp({ quality: 82, effort: 5 })
      .toBuffer()
    const objectKey = `dishes/${dishId}/${sha256}.webp`
    const thumbnailKey = `dishes/${dishId}/${sha256}-thumb.webp`

    await ensureImageBucket()
    await Promise.all([
      putImage(objectKey, normalizedImage.data, { 'X-Amz-Meta-Dish-Id': dishId, 'X-Amz-Meta-Sha256': sha256 }),
      putImage(thumbnailKey, thumbnail, { 'X-Amz-Meta-Dish-Id': dishId, 'X-Amz-Meta-Variant': 'thumbnail' }),
    ])

    const insertedRow = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO media.dish_images
          (dish_id, sha256, object_key, thumbnail_key, width, height, mime_type, size_bytes, source_url, license_type, attribution, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'image/webp', $7, NULLIF($8, ''), $9, NULLIF($10, ''), $11)
         RETURNING *`,
        [dishId, sha256, objectKey, thumbnailKey, normalizedImage.info.width, normalizedImage.info.height, normalizedImage.data.length, sourceUrl, licenseType, attribution, JSON.stringify({
          originalFileName: String(originalFileName || request.file.originalname).replace(/[\\/]/g, '').slice(0, 255),
          collection: String(collection).replace(/[^a-z0-9_-]/gi, '').slice(0, 80),
          originalMimeType: request.file.mimetype,
          originalSizeBytes: request.file.size,
        })],
      )
      return result.rows[0]
    })
    response.status(201).json({ image: await serializeImage(insertedRow), deduplicated: false })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/images/:id', requireUploadToken, async (request, response, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
      response.status(400).json({ error: 'invalid_image_id' })
      return
    }
    const result = await pool.query(
      `UPDATE media.dish_images SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [request.params.id],
    )
    if (!result.rowCount) {
      response.status(404).json({ error: 'image_not_found' })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error instanceof BillingError) {
    response.status(error.status).json({ error: error.code, message: error.message })
    return
  }
  if (error instanceof multer.MulterError) {
    response.status(400).json({ error: error.code })
    return
  }
  response.status(500).json({ error: 'service_error' })
})

await ensureImageBucket()
app.listen(config.port, () => {
  console.log(`Meal platform service listening on http://127.0.0.1:${config.port}`)
})

process.on('SIGTERM', async () => {
  await pool.end()
  process.exit(0)
})
