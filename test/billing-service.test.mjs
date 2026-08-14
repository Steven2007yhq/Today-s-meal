import assert from 'node:assert/strict'
import test from 'node:test'
import { addBillingPeriod, buildMembershipReminder, rebaseEntitlementSchedule, validatePaymentAgainstOrder } from '../server/billing-service.mjs'

test('payment amount and currency must exactly match the server order', () => {
  const order = { amount_fen: 2999, currency: 'CNY' }
  assert.deepEqual(validatePaymentAgainstOrder(order, { amountFen: 2999, currency: 'CNY' }), { ok: true })
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: 1, currency: 'CNY' }).code, 'payment_amount_mismatch')
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: 2999, currency: 'USD' }).code, 'payment_currency_mismatch')
  assert.equal(validatePaymentAgainstOrder(order, { amountFen: Number.NaN, currency: 'CNY' }).code, 'payment_amount_mismatch')
})

test('membership periods use calendar months and years without end-of-month drift', () => {
  const januaryEnd = new Date('2026-01-31T08:30:00.000Z')
  const februaryEnd = addBillingPeriod(januaryEnd, { billing_period: 'month', billing_period_count: 1 })
  assert.equal(februaryEnd.toISOString(), '2026-02-28T08:30:00.000Z')
  assert.equal(
    addBillingPeriod(februaryEnd, { billing_period: 'month', billing_period_count: 1 }).toISOString(),
    '2026-03-31T08:30:00.000Z',
  )
  assert.equal(
    addBillingPeriod(new Date('2024-02-29T12:00:00.000Z'), { billing_period: 'year', billing_period_count: 1 }).toISOString(),
    '2025-02-28T12:00:00.000Z',
  )
})

test('legacy day products remain compatible and reminders start seven days before expiry', () => {
  const now = new Date('2026-08-14T00:00:00.000Z')
  assert.equal(
    addBillingPeriod(now, { billing_period: 'day', duration_days: 31 }).toISOString(),
    '2026-09-14T00:00:00.000Z',
  )
  assert.equal(buildMembershipReminder(new Date(now.getTime() + 8 * 86_400_000), now), null)
  assert.equal(buildMembershipReminder(new Date(now.getTime() + 7 * 86_400_000), now).level, 'upcoming')
  assert.equal(buildMembershipReminder(new Date(now.getTime() + 3 * 86_400_000), now).level, 'soon')
  assert.equal(buildMembershipReminder(new Date(now.getTime() + 1 * 86_400_000), now).level, 'urgent')
})

test('refunding an earlier entitlement removes its duration and pulls later purchases forward', () => {
  const rebased = rebaseEntitlementSchedule(
    { starts_at: '2026-08-01T00:00:00.000Z', ends_at: '2026-09-01T00:00:00.000Z' },
    [
      { id: 'annual', starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2027-09-01T00:00:00.000Z' },
      { id: 'monthly', starts_at: '2027-09-01T00:00:00.000Z', ends_at: '2027-10-01T00:00:00.000Z' },
    ],
  )
  assert.equal(rebased[0].startsAt.toISOString(), '2026-08-01T00:00:00.000Z')
  assert.equal(rebased[0].endsAt.toISOString(), '2027-08-01T00:00:00.000Z')
  assert.equal(rebased[1].startsAt.toISOString(), '2027-08-01T00:00:00.000Z')
  assert.equal(rebased[1].endsAt.toISOString(), '2027-08-31T00:00:00.000Z')
})

test('refunding a current segment preserves later purchased duration from refund time', () => {
  const rebased = rebaseEntitlementSchedule(
    { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-02-01T00:00:00.000Z' },
    [{ id: 'annual', starts_at: '2026-02-01T00:00:00.000Z', ends_at: '2027-02-01T00:00:00.000Z' }],
    '2026-01-15T12:00:00.000Z',
  )
  assert.equal(rebased[0].startsAt.toISOString(), '2026-01-15T12:00:00.000Z')
  assert.equal(rebased[0].endsAt.toISOString(), '2027-01-15T12:00:00.000Z')
})
