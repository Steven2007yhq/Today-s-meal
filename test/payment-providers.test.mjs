import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { createPaymentProviderGateway, serializeAlipaySignContent } from '../server/payment-providers.mjs'

test('Alipay canonical parameters exclude signature fields and use stable ASCII order', () => {
  assert.equal(
    serializeAlipaySignContent({ z: 'last', sign: 'secret', app_id: 'app', sign_type: 'RSA2', empty: '' }),
    'app_id=app&z=last',
  )
})

test('development payment channel is available only when explicitly enabled in development', async () => {
  const disabled = createPaymentProviderGateway({ isDevelopment: true, devSimulation: false })
  assert.equal(disabled.status().dev.configured, false)

  const gateway = createPaymentProviderGateway({ isDevelopment: true, devSimulation: true })
  assert.equal(gateway.status().dev.configured, true)
  const result = await gateway.createOrder('dev', { outTradeNo: 'HC123' })
  assert.equal(result.qrPayload, 'mealapp-dev-pay://HC123')
  assert.equal(gateway.validateNotificationIdentity('dev', {}), true)
})

test('Alipay precreate accepts only a correctly signed response body', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' })
  const signedNode = '{ "code":"10000", "qr_code":"https://pay.example/qr" }'
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signedNode), privatePem).toString('base64')
  const gateway = createPaymentProviderGateway({
    notifyBaseUrl: 'https://billing.example',
    alipay: {
      appId: 'app-id',
      sellerId: 'seller-id',
      privateKeyPath: 'merchant-private.pem',
      publicKeyPath: 'alipay-public.pem',
      gateway: 'https://openapi.alipay.com/gateway.do',
    },
  }, {
    readFileImpl: async (filePath) => filePath.includes('private') ? privatePem : publicPem,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => `{"alipay_trade_precreate_response":${signedNode},"sign":"${signature}"}`,
    }),
  })
  const result = await gateway.createOrder('alipay', {
    outTradeNo: 'HC202608140001',
    amountFen: 2999,
    currency: 'CNY',
    description: 'Pro 饭搭子月度会员',
    expiresAt: new Date(Date.now() + 900_000),
  })
  assert.equal(result.qrPayload, 'https://pay.example/qr')
})

test('Alipay precreate fails closed when response signature is invalid', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const gateway = createPaymentProviderGateway({
    notifyBaseUrl: 'https://billing.example',
    alipay: {
      appId: 'app-id', sellerId: 'seller-id', privateKeyPath: 'private.pem', publicKeyPath: 'public.pem',
    },
  }, {
    readFileImpl: async (filePath) => filePath === 'private.pem'
      ? privateKey.export({ type: 'pkcs8', format: 'pem' })
      : publicKey.export({ type: 'spki', format: 'pem' }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '{"alipay_trade_precreate_response":{"code":"10000","qr_code":"fake"},"sign":"invalid"}',
    }),
  })
  await assert.rejects(() => gateway.createOrder('alipay', {
    outTradeNo: 'HC202608140002', amountFen: 2999, currency: 'CNY', description: '会员', expiresAt: new Date(),
  }), /响应验签失败/)
})

test('Alipay active query converts a signed paid trade into a verified payment notification', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' })
  const signedNode = '{"code":"10000","trade_status":"TRADE_SUCCESS","out_trade_no":"HC202608140003","trade_no":"ALI-003","total_amount":"29.99","seller_id":"seller-id"}'
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signedNode), privatePem).toString('base64')
  const gateway = createPaymentProviderGateway({
    notifyBaseUrl: 'https://billing.example',
    alipay: {
      appId: 'app-id', sellerId: 'seller-id', privateKeyPath: 'private.pem', publicKeyPath: 'public.pem',
    },
  }, {
    readFileImpl: async (filePath) => filePath === 'private.pem' ? privatePem : publicPem,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => `{"alipay_trade_query_response":${signedNode},"sign":"${signature}"}`,
    }),
  })
  const result = await gateway.queryOrder('alipay', {
    outTradeNo: 'HC202608140003', amountFen: 2999, currency: 'CNY',
  })
  assert.equal(result.paid, true)
  assert.equal(result.amountFen, 2999)
  assert.equal(result.providerTradeNo, 'ALI-003')
  assert.equal(gateway.validateNotificationIdentity('alipay', result), true)
})

test('WeChat active query requires and validates the platform response signature', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' })
  const responseBody = JSON.stringify({
    appid: 'wx-app', mchid: 'wx-merchant', out_trade_no: 'HC202608140004', transaction_id: 'WX-004',
    trade_state: 'SUCCESS', trade_state_desc: '支付成功', amount: { total: 2999, currency: 'CNY' },
  })
  const responseTimestamp = '1786694400'
  const responseNonce = 'response-nonce'
  const responseSignature = crypto.sign('RSA-SHA256', Buffer.from(`${responseTimestamp}\n${responseNonce}\n${responseBody}\n`), privatePem).toString('base64')
  const gateway = createPaymentProviderGateway({
    notifyBaseUrl: 'https://billing.example',
    wechat: {
      mchId: 'wx-merchant', appId: 'wx-app', certificateSerial: 'merchant-cert', privateKeyPath: 'private.pem',
      apiV3Key: '12345678901234567890123456789012', publicKeyId: 'wechat-key-id', publicKeyPath: 'public.pem',
    },
  }, {
    readFileImpl: async (filePath) => filePath === 'private.pem' ? privatePem : publicPem,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: (name) => ({
        'wechatpay-timestamp': responseTimestamp,
        'wechatpay-nonce': responseNonce,
        'wechatpay-signature': responseSignature,
        'wechatpay-serial': 'wechat-key-id',
      })[name.toLowerCase()] || '' },
      text: async () => responseBody,
    }),
  })
  const result = await gateway.queryOrder('wechat', {
    outTradeNo: 'HC202608140004', amountFen: 2999, currency: 'CNY',
  })
  assert.equal(result.paid, true)
  assert.equal(result.providerTradeNo, 'WX-004')
  assert.equal(gateway.validateNotificationIdentity('wechat', result), true)
})
