import { INSECURE_DEFAULTS } from './config.mjs'

// A secret shorter than this is not a secret, whatever it says in .env.
const MINIMUM_SECRET_LENGTH = 24
const PLACEHOLDER_PATTERN = /^(replace|change)[_-]/i

function describeSecretProblem({ envName, value, insecureDefault }) {
  const secret = String(value || '')
  if (!secret) return `${envName} 未设置。`
  if (secret === insecureDefault) return `${envName} 仍是 .env.example 里的占位值。`
  if (PLACEHOLDER_PATTERN.test(secret)) return `${envName} 看起来仍是占位值（以 replace- / change- 开头）。`
  if (secret.length < MINIMUM_SECRET_LENGTH) return `${envName} 太短，至少需要 ${MINIMUM_SECRET_LENGTH} 个字符。`
  return ''
}

// Returns a human-readable list of everything that makes this configuration
// unsafe to expose. An empty array means the config is fit to serve traffic.
export function collectConfigProblems(config) {
  const problems = []

  const secretChecks = [
    { envName: 'IMAGE_UPLOAD_TOKEN', value: config.uploadToken, insecureDefault: INSECURE_DEFAULTS.uploadToken },
    { envName: 'AUTH_SESSION_SECRET', value: config.auth.secret, insecureDefault: INSECURE_DEFAULTS.authSecret },
    { envName: 'AI_ASSIGNMENT_SECRET', value: config.ai.assignmentSecret, insecureDefault: INSECURE_DEFAULTS.assignmentSecret },
  ]
  for (const check of secretChecks) {
    const problem = describeSecretProblem(check)
    if (problem) problems.push(problem)
  }

  if (config.databaseUrl === INSECURE_DEFAULTS.databaseUrl || config.databaseUrl.includes('mealapp_dev_password')) {
    problems.push('DATABASE_URL 仍在使用开发用的数据库口令 mealapp_dev_password。')
  }
  if (config.minio.accessKey === INSECURE_DEFAULTS.minioAccessKey) {
    problems.push('MINIO_ACCESS_KEY 仍是开发默认值。')
  }
  if (config.minio.secretKey === INSECURE_DEFAULTS.minioSecretKey) {
    problems.push('MINIO_SECRET_KEY 仍是开发默认值。')
  }
  if (config.auth.exposeDevCode) {
    problems.push('AUTH_EXPOSE_DEV_CODE=true 会把验证码写进 /api/auth/send-code 的响应体，任何人都能注册或登录任意账号。')
  }

  return problems
}

// Development is opted into explicitly; anything else — including an unset
// NODE_ENV — is treated as production and refuses to start.
export function assertStartupConfig(config, { log = console } = {}) {
  const problems = collectConfigProblems(config)
  if (!problems.length) return

  const numbered = problems.map((problem, index) => `  ${index + 1}. ${problem}`).join('\n')
  if (config.isDevelopment) {
    log.warn(`[config] 开发模式放行了以下配置，上线前必须全部修复：\n${numbered}`)
    return
  }

  throw new Error([
    `服务器拒绝启动：检测到 ${problems.length} 项不安全的配置。`,
    numbered,
    '',
    `当前 NODE_ENV=${config.nodeEnv || '(未设置)'}，按生产环境处理。`,
    '本机开发：在 .env 中设置 NODE_ENV=development。',
    '部署环境：补齐上述配置项后重启。',
  ].join('\n'))
}
