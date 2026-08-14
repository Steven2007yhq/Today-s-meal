import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePaymentAgainstOrder } from '../server/billing-service.mjs'

test('payment amount and currency must exactly match the server order', () => {
  const order = { amount_fen: 2999, currency: 'CNY' }
  assert.deepEqual(validatePaymentAgainstOrder(order, { amountFen: 2999, currency: 'CNY' }), { ok: true })
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: 1, currency: 'CNY' }).code, 'payment_amount_mismatch')
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: 2999, currency: 'USD' }).code, 'payment_currency_mismatch')
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: Number.NaN, currency: 'CNY' }).code, 'payment_amount_mismatch')
})
