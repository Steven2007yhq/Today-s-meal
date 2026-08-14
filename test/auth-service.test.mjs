import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateVerificationCode,
  hashPassword,
  isValidCaptchaToken,
  maskIdentifier,
  normalizeAuthChannel,
  normalizeIdentifier,
  providerForIdentifier,
  validatePassword,
  verifyPassword,
} from '../server/auth-service.mjs'

test('authentication identifiers are normalized to the supported channels', () => {
  assert.equal(normalizeAuthChannel(' PHONE '), 'phone')
  assert.equal(normalizeIdentifier('phone', '138-0013-8000'), '13800138000')
  assert.equal(normalizeIdentifier('phone', '+86 138-0013-8000'), '')
  assert.equal(normalizeIdentifier('phone', '23800138000'), '')
  assert.equal(normalizeIdentifier('email', ' USER@QQ.COM '), 'user@qq.com')
  assert.equal(normalizeIdentifier('email', 'user@gmail.com'), '')
  assert.equal(providerForIdentifier('email', 'user@qq.com'), 'email_qq')
  assert.equal(maskIdentifier('phone', '13800138000'), '138****8000')
})

test('password and captcha format boundaries remain explicit', () => {
  assert.match(validatePassword('12345'), /至少/)
  assert.equal(validatePassword('123456'), '')
  assert.match(validatePassword('x'.repeat(73)), /超过/)
  assert.equal(isValidCaptchaToken('captcha_token_123456'), true)
  assert.equal(isValidCaptchaToken('short'), false)
})

test('verification codes and password hashes are non-plaintext and verifiable', async () => {
  assert.equal(generateVerificationCode({ fixedCode: '123456' }), '123456')
  const passwordHash = await hashPassword('a-maintainable-password')
  assert.notEqual(passwordHash, 'a-maintainable-password')
  assert.equal(await verifyPassword('a-maintainable-password', passwordHash), true)
  assert.equal(await verifyPassword('wrong-password', passwordHash), false)
})
