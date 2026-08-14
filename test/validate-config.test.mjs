import assert from 'node:assert/strict'
import test from 'node:test'
import { INSECURE_DEFAULTS } from '../server/config.mjs'
import { assertStartupConfig, collectConfigProblems } from '../server/validate-config.mjs'

function safeConfig(overrides = {}) {
  return {
    nodeEnv: 'production',
    isDevelopment: false,
    uploadToken: 'upload-token-that-is-longer-than-24-characters',
    databaseUrl: 'postgresql://service:unique-password@db.internal:5432/meals',
    auth: {
      secret: 'auth-secret-that-is-longer-than-24-characters',
      exposeDevCode: false,
    },
    ai: { assignmentSecret: 'assignment-secret-longer-than-24-characters' },
    minio: { accessKey: 'production-access', secretKey: 'production-secret-longer-than-24-characters' },
    ...overrides,
  }
}

test('production-safe configuration passes startup validation', () => {
  const config = safeConfig()
  assert.deepEqual(collectConfigProblems(config), [])
  assert.doesNotThrow(() => assertStartupConfig(config))
})

test('insecure defaults fail closed outside explicit development', () => {
  const config = safeConfig({
    uploadToken: INSECURE_DEFAULTS.uploadToken,
    databaseUrl: INSECURE_DEFAULTS.databaseUrl,
    auth: { secret: INSECURE_DEFAULTS.authSecret, exposeDevCode: true },
    ai: { assignmentSecret: INSECURE_DEFAULTS.assignmentSecret },
    minio: { accessKey: INSECURE_DEFAULTS.minioAccessKey, secretKey: INSECURE_DEFAULTS.minioSecretKey },
  })
  assert.ok(collectConfigProblems(config).length >= 6)
  assert.throws(() => assertStartupConfig(config), /服务器拒绝启动/)
})

test('explicit development warns about unsafe settings instead of hiding them', () => {
  const warnings = []
  const config = safeConfig({
    nodeEnv: 'development',
    isDevelopment: true,
    uploadToken: INSECURE_DEFAULTS.uploadToken,
  })
  assert.doesNotThrow(() => assertStartupConfig(config, { log: { warn: (message) => warnings.push(message) } }))
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /开发模式放行/)
})

test('production refuses the no-charge development payment channel', () => {
  const config = safeConfig({ billing: { devSimulation: true } })
  assert.match(collectConfigProblems(config).join('\n'), /PAYMENT_DEV_SIMULATION/)
})

test('partial merchant settings and non-HTTPS callbacks are rejected', () => {
  const config = safeConfig({
    billing: {
      notifyBaseUrl: 'http://billing.example',
      wechat: { mchId: 'merchant-only' },
      alipay: { appId: 'app-only' },
    },
  })
  const problems = collectConfigProblems(config).join('\n')
  assert.match(problems, /微信支付参数只配置了一部分/)
  assert.match(problems, /支付宝参数只配置了一部分/)
  assert.match(problems, /公网 HTTPS/)
})
