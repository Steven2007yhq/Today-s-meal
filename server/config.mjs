import 'dotenv/config'

// Placeholders shipped in .env.example, kept as fallbacks so a fresh clone can
// run locally. They are also the exact values validate-config.mjs refuses to
// start with unless NODE_ENV=development, so both files must stay in sync.
export const INSECURE_DEFAULTS = Object.freeze({
  uploadToken: 'replace-this-development-token',
  authSecret: 'change-this-development-auth-secret',
  assignmentSecret: 'change-this-development-assignment-secret',
  databaseUrl: 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha',
  minioAccessKey: 'mealapp_minio',
  minioSecretKey: 'mealapp_minio_dev_password',
})

// Development conveniences are opt-in via an explicit NODE_ENV, never via its
// absence: an unset NODE_ENV must behave exactly like production.
const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`)
  return value
}

function secretListFromEnv(...names) {
  return [...new Set(names
    .flatMap((name) => String(process.env[name] || '').split(/[\r\n,;]+/))
    .map((value) => value.trim())
    .filter((value) => value && !/^replace[_-]/i.test(value)))]
}

export const config = {
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  port: numberFromEnv('IMAGE_API_PORT', 8787),
  databaseUrl: process.env.DATABASE_URL || INSECURE_DEFAULTS.databaseUrl,
  uploadToken: process.env.IMAGE_UPLOAD_TOKEN || INSECURE_DEFAULTS.uploadToken,
  corsOrigins: (process.env.IMAGE_API_CORS_ORIGINS || 'http://localhost:5173,null').split(',').map((origin) => origin.trim()),
  auth: {
    secret: process.env.AUTH_SESSION_SECRET || INSECURE_DEFAULTS.authSecret,
    sessionTtlSeconds: numberFromEnv('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 30),
    verificationTtlSeconds: numberFromEnv('AUTH_VERIFICATION_TTL_SECONDS', 5 * 60),
    verificationCooldownSeconds: numberFromEnv('AUTH_VERIFICATION_COOLDOWN_SECONDS', 60),
    // Opt-in only. Returning the verification code in the HTTP response is an
    // account-takeover hole, so an unset value must never enable it.
    exposeDevCode: String(process.env.AUTH_EXPOSE_DEV_CODE || 'false').toLowerCase() === 'true',
    devCode: String(process.env.AUTH_DEV_CODE || '123456').replace(/\D/g, '').slice(0, 6) || '123456',
    wechatAppId: process.env.WECHAT_APP_ID || '',
    wechatRedirectUri: process.env.WECHAT_REDIRECT_URI || '',
    qqAppId: process.env.QQ_APP_ID || '',
    qqRedirectUri: process.env.QQ_REDIRECT_URI || '',
  },
  ai: {
    apiKeys: secretListFromEnv('DEEPSEEK_API_KEYS', 'DEEPSEEK_API_KEY'),
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    assignmentSecret: process.env.AI_ASSIGNMENT_SECRET || INSECURE_DEFAULTS.assignmentSecret,
    gatewayToken: process.env.AI_GATEWAY_TOKEN || '',
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: numberFromEnv('MINIO_PORT', 9000),
    useSSL: String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || INSECURE_DEFAULTS.minioAccessKey,
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || INSECURE_DEFAULTS.minioSecretKey,
    bucket: process.env.MINIO_BUCKET || 'dish-images',
    region: process.env.MINIO_REGION || 'cn-north-1',
  },
}
