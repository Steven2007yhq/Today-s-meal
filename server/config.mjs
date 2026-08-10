import 'dotenv/config'

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
  port: numberFromEnv('IMAGE_API_PORT', 8787),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha',
  uploadToken: process.env.IMAGE_UPLOAD_TOKEN || 'replace-this-development-token',
  corsOrigins: (process.env.IMAGE_API_CORS_ORIGINS || 'http://localhost:5173,null').split(',').map((origin) => origin.trim()),
  auth: {
    secret: process.env.AUTH_SESSION_SECRET || 'change-this-development-auth-secret',
    sessionTtlSeconds: numberFromEnv('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 30),
    verificationTtlSeconds: numberFromEnv('AUTH_VERIFICATION_TTL_SECONDS', 5 * 60),
    verificationCooldownSeconds: numberFromEnv('AUTH_VERIFICATION_COOLDOWN_SECONDS', 60),
    exposeDevCode: String(process.env.AUTH_EXPOSE_DEV_CODE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true',
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
    assignmentSecret: process.env.AI_ASSIGNMENT_SECRET || 'change-this-development-assignment-secret',
    gatewayToken: process.env.AI_GATEWAY_TOKEN || '',
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: numberFromEnv('MINIO_PORT', 9000),
    useSSL: String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'mealapp_minio',
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'mealapp_minio_dev_password',
    bucket: process.env.MINIO_BUCKET || 'dish-images',
    region: process.env.MINIO_REGION || 'cn-north-1',
  },
}
