import crypto from 'node:crypto'

const ORDER_IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9._:-]{8,80}$/
const SUPPORTED_PROVIDERS = new Set(['wechat', 'alipay', 'dev'])
const DAY_MS = 86_400_000

export class BillingError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'BillingError'
    this.code = code
    this.status = status
  }
}

function createOutTradeNo() {
  return `HC${Date.now().toString(36)}${crypto.randomBytes(7).toString('hex')}`.toUpperCase().slice(0, 32)
}

function serializeProduct(row) {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    amountFen: Number(row.amount_fen),
    currency: row.currency,
    durationDays: Number(row.duration_days),
    billingPeriod: row.billing_period || 'day',
    billingPeriodCount: Number(row.billing_period_count || 1),
  }
}

function serializeOrder(row) {
  return {
    id: row.id,
    outTradeNo: row.out_trade_no,
    productCode: row.product_code,
    productName: row.product_name,
    billingPeriod: row.billing_period || 'day',
    billingPeriodCount: Number(row.billing_period_count || 1),
    durationDays: Number(row.duration_days || 0),
    provider: row.provider,
    amountFen: Number(row.amount_fen),
    currency: row.currency,
    status: row.status,
    qrPayload: row.status === 'pending' ? row.qr_payload : null,
    failureCode: row.failure_code || null,
    failureMessage: row.failure_message || null,
    expiresAt: row.expires_at,
    paidAt: row.paid_at || null,
    refundedAt: row.refunded_at || null,
    refundReason: row.refund_reason || null,
    lastReconciledAt: row.last_reconciled_at || null,
    createdAt: row.created_at,
  }
}

export function addBillingPeriod(startAt, product = {}) {
  const start = new Date(startAt)
  if (!Number.isFinite(start.getTime())) throw new TypeError('会员周期开始时间无效。')
  const period = String(product.billing_period || product.billingPeriod || 'day')
  const count = Math.max(1, Math.round(Number(product.billing_period_count || product.billingPeriodCount || 1)))
  if (period === 'day') {
    const durationDays = Math.max(1, Math.round(Number(product.duration_days || product.durationDays || count)))
    return new Date(start.getTime() + durationDays * DAY_MS)
  }

  const next = new Date(start)
  const originalDay = start.getUTCDate()
  const originalMonth = start.getUTCMonth()
  const originalYear = start.getUTCFullYear()
  const originalLastDay = new Date(Date.UTC(originalYear, originalMonth + 1, 0)).getUTCDate()
  const monthOffset = period === 'year' ? count * 12 : count
  const absoluteMonth = originalMonth + monthOffset
  const targetYear = originalYear + Math.floor(absoluteMonth / 12)
  const targetMonth = ((absoluteMonth % 12) + 12) % 12
  const targetLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = originalDay === originalLastDay ? targetLastDay : Math.min(originalDay, targetLastDay)
  next.setUTCDate(1)
  next.setUTCFullYear(targetYear, targetMonth, targetDay)
  return next
}

export function buildMembershipReminder(validUntil, now = new Date()) {
  if (!validUntil) return null
  const remainingMs = new Date(validUntil).getTime() - new Date(now).getTime()
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null
  const daysRemaining = Math.ceil(remainingMs / DAY_MS)
  if (daysRemaining > 7) return null
  const level = daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'soon' : 'upcoming'
  return {
    level,
    daysRemaining,
    message: daysRemaining <= 1 ? 'Pro 会员将在 1 天内到期。' : `Pro 会员还有 ${daysRemaining} 天到期。`,
  }
}

export function rebaseEntitlementSchedule(refundedEntitlement, laterEntitlements = [], effectiveStart = null) {
  let cursor = new Date(effectiveStart || refundedEntitlement?.starts_at || refundedEntitlement?.startsAt)
  if (!Number.isFinite(cursor.getTime())) throw new TypeError('退款权益开始时间无效。')
  return laterEntitlements.map((entitlement) => {
    const previousStart = new Date(entitlement.starts_at || entitlement.startsAt)
    const previousEnd = new Date(entitlement.ends_at || entitlement.endsAt)
    const durationMs = previousEnd.getTime() - previousStart.getTime()
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new TypeError('待顺延权益周期无效。')
    const startsAt = new Date(cursor)
    const endsAt = new Date(cursor.getTime() + durationMs)
    cursor = endsAt
    return { ...entitlement, startsAt, endsAt }
  })
}

function serializeMembership(row, now = new Date()) {
  const validUntil = row?.valid_until || null
  const reminder = buildMembershipReminder(validUntil, now)
  const nowTime = new Date(now).getTime()
  return {
    isPro: Boolean(validUntil && new Date(validUntil).getTime() > nowTime),
    plan: validUntil ? row.product_code || 'pro' : 'free',
    productCode: validUntil ? row.product_code || null : null,
    productName: validUntil ? row.product_name || 'Pro 饭搭子' : null,
    billingPeriod: validUntil ? row.billing_period || 'day' : null,
    billingPeriodCount: validUntil ? Number(row.billing_period_count || 1) : 0,
    currentPeriodStart: validUntil ? row.starts_at || null : null,
    validUntil,
    daysRemaining: validUntil ? Math.max(0, Math.ceil((new Date(validUntil).getTime() - new Date(now).getTime()) / DAY_MS)) : 0,
    reminder,
    autoRenew: false,
    source: 'server',
  }
}

export function validatePaymentAgainstOrder(order, notification) {
  if (!Number.isSafeInteger(notification.amountFen) || notification.amountFen !== Number(order.amount_fen)) {
    return { ok: false, code: 'payment_amount_mismatch', message: '支付金额与订单金额不一致，已转人工核对。' }
  }
  if (String(notification.currency || '').toUpperCase() !== order.currency) {
    return { ok: false, code: 'payment_currency_mismatch', message: '支付币种与订单币种不一致，已转人工核对。' }
  }
  return { ok: true }
}

export function createBillingService({ pool, withTransaction, paymentGateway, orderTtlMinutes = 15 }) {
  async function listProducts() {
    const result = await pool.query(
      `SELECT code, name, description, amount_fen, currency, duration_days,
              billing_period, billing_period_count
       FROM billing.products
       WHERE active = true
       ORDER BY sort_order ASC, amount_fen ASC`,
    )
    return { products: result.rows.map(serializeProduct), providers: paymentGateway.status() }
  }

  async function readMembership(userId, client = pool) {
    const result = await client.query(
      `SELECT current_entitlement.starts_at,
              schedule.valid_until,
              order_row.product_code,
              order_row.product_name,
              order_row.billing_period,
              order_row.billing_period_count
       FROM (
         SELECT max(ends_at) AS valid_until
         FROM billing.entitlements
         WHERE user_id = $1 AND kind = 'pro' AND status = 'active' AND ends_at > now()
       ) schedule
       LEFT JOIN LATERAL (
         SELECT *
         FROM billing.entitlements
         WHERE user_id = $1 AND kind = 'pro' AND status = 'active'
           AND starts_at <= now() AND ends_at > now()
         ORDER BY starts_at DESC
         LIMIT 1
       ) current_entitlement ON true
       LEFT JOIN billing.orders order_row ON order_row.id = current_entitlement.source_order_id`,
      [userId],
    )
    return serializeMembership(result.rows[0])
  }

  async function findOrder(userId, orderId, client = pool) {
    await client.query(
      `UPDATE billing.orders
       SET status = 'expired', updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending' AND expires_at <= now()`,
      [orderId, userId],
    )
    const result = await client.query(
      `SELECT order_row.*
       FROM billing.orders order_row
       WHERE order_row.id = $1 AND order_row.user_id = $2
       LIMIT 1`,
      [orderId, userId],
    )
    if (!result.rowCount) throw new BillingError('order_not_found', '订单不存在或不属于当前账号。', 404)
    return result.rows[0]
  }

  async function readOrder(userId, orderId) {
    const row = await findOrder(userId, orderId)
    return { order: serializeOrder(row), membership: await readMembership(userId) }
  }

  async function listOrders(userId, limit = 20) {
    const safeLimit = Math.max(1, Math.min(50, Math.round(Number(limit) || 20)))
    await pool.query(
      `UPDATE billing.orders
       SET status = 'expired', updated_at = now()
       WHERE user_id = $1 AND status = 'pending' AND expires_at <= now()`,
      [userId],
    )
    const result = await pool.query(
      `SELECT * FROM billing.orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, safeLimit],
    )
    return { orders: result.rows.map(serializeOrder) }
  }

  async function createOrder({ userId, productCode, provider, idempotencyKey }) {
    if (!SUPPORTED_PROVIDERS.has(provider)) throw new BillingError('unsupported_provider', '请选择可用的支付方式。')
    if (!ORDER_IDEMPOTENCY_PATTERN.test(String(idempotencyKey || ''))) {
      throw new BillingError('invalid_idempotency_key', '订单请求标识无效，请刷新后重试。')
    }
    const providerState = paymentGateway.status()[provider]
    if (!providerState?.configured) throw new BillingError('provider_not_configured', '该支付通道尚未配置，请稍后再试。', 503)

    const existing = await pool.query(
      `SELECT order_row.*
       FROM billing.orders order_row
       WHERE order_row.user_id = $1 AND order_row.idempotency_key = $2
       LIMIT 1`,
      [userId, idempotencyKey],
    )
    if (existing.rowCount) return { order: serializeOrder(existing.rows[0]), reused: true }

    const productResult = await pool.query(
      `SELECT code, name, description, amount_fen, currency, duration_days,
              billing_period, billing_period_count
       FROM billing.products WHERE code = $1 AND active = true LIMIT 1`,
      [productCode],
    )
    if (!productResult.rowCount) throw new BillingError('product_not_found', '会员商品不存在或已下架。', 404)
    const product = productResult.rows[0]
    const expiresAt = new Date(Date.now() + Math.max(5, Math.min(60, orderTtlMinutes)) * 60_000)
    const insert = await pool.query(
      `INSERT INTO billing.orders
         (out_trade_no, user_id, product_code, product_name, provider, amount_fen, currency,
          duration_days, billing_period, billing_period_count, idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        createOutTradeNo(), userId, product.code, product.name, provider, product.amount_fen, product.currency,
        product.duration_days, product.billing_period, product.billing_period_count, idempotencyKey, expiresAt,
      ],
    )
    if (!insert.rowCount) {
      const raced = await pool.query(
        `SELECT order_row.*
         FROM billing.orders order_row
         WHERE order_row.user_id = $1 AND order_row.idempotency_key = $2 LIMIT 1`,
        [userId, idempotencyKey],
      )
      return { order: serializeOrder(raced.rows[0]), reused: true }
    }

    const order = insert.rows[0]
    try {
      const providerOrder = await paymentGateway.createOrder(provider, {
        outTradeNo: order.out_trade_no,
        amountFen: Number(order.amount_fen),
        currency: order.currency,
        description: product.name,
        expiresAt,
      })
      const updated = await pool.query(
        `UPDATE billing.orders SET qr_payload = $2, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [order.id, providerOrder.qrPayload],
      )
      return { order: serializeOrder(updated.rows[0]), reused: false }
    } catch (error) {
      await pool.query(
        `UPDATE billing.orders
         SET status = 'failed', failure_code = $2, failure_message = $3, updated_at = now()
         WHERE id = $1 AND status = 'pending'`,
        [order.id, String(error.code || 'provider_order_failed').slice(0, 80), String(error.message || '支付下单失败。').slice(0, 300)],
      )
      throw new BillingError(error.code || 'provider_order_failed', error.message || '支付下单失败。', 502)
    }
  }

  async function confirmNotification(provider, notification) {
    if (!paymentGateway.validateNotificationIdentity(provider, notification)) {
      throw new BillingError('payment_identity_mismatch', '支付通知的商户身份不匹配。', 401)
    }
    if (!notification.providerEventId || !notification.outTradeNo) {
      throw new BillingError('invalid_payment_notification', '支付通知缺少必要字段。')
    }

    return withTransaction(async (client) => {
      const eventInsert = await client.query(
        `INSERT INTO billing.payment_events
           (provider, provider_event_id, out_trade_no, event_type, verified, payload)
         VALUES ($1, $2, $3, $4, true, $5::jsonb)
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING id`,
        [provider, notification.providerEventId, notification.outTradeNo, notification.eventType, JSON.stringify(notification.payload || {})],
      )
      const duplicateEvent = !eventInsert.rowCount

      const orderResult = await client.query(
        `SELECT order_row.*
         FROM billing.orders order_row
         WHERE order_row.out_trade_no = $1
         FOR UPDATE OF order_row`,
        [notification.outTradeNo],
      )
      if (!orderResult.rowCount) return { accepted: false, code: 'order_not_found' }
      const order = orderResult.rows[0]
      if (order.provider !== provider) return { accepted: false, code: 'payment_provider_mismatch' }
      const validation = validatePaymentAgainstOrder(order, notification)
      if (!validation.ok) return { accepted: false, ...validation }
      if (!notification.paid) return { accepted: true, paid: false, duplicate: duplicateEvent }
      if (order.status === 'paid') return { accepted: true, paid: true, duplicate: true }
      if (!['pending', 'expired', 'failed'].includes(order.status)) return { accepted: false, code: 'order_not_payable' }

      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [order.user_id])
      await client.query(
        `UPDATE billing.orders
         SET status = 'paid', provider_trade_no = $2, paid_at = now(), updated_at = now(),
             failure_code = NULL, failure_message = NULL
         WHERE id = $1`,
        [order.id, notification.providerTradeNo || null],
      )
      const activeResult = await client.query(
        `SELECT max(ends_at) AS valid_until
         FROM billing.entitlements
         WHERE user_id = $1 AND kind = 'pro' AND status = 'active' AND ends_at > now()`,
        [order.user_id],
      )
      const currentEnd = activeResult.rows[0]?.valid_until
      const startsAt = currentEnd && new Date(currentEnd).getTime() > Date.now() ? new Date(currentEnd) : new Date()
      const endsAt = addBillingPeriod(startsAt, order)
      await client.query(
        `INSERT INTO billing.entitlements (user_id, source_order_id, starts_at, ends_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source_order_id) DO NOTHING`,
        [order.user_id, order.id, startsAt, endsAt],
      )
      return { accepted: true, paid: true, userId: order.user_id, duplicate: duplicateEvent }
    })
  }

  async function handleNotification(provider, request) {
    const notification = await paymentGateway.parseNotification(provider, request)
    return confirmNotification(provider, notification)
  }

  async function reconcileOrder(userId, orderId) {
    const order = await findOrder(userId, orderId)
    if (['paid', 'refunded'].includes(order.status)) return readOrder(userId, orderId)
    if (order.provider === 'dev') throw new BillingError('reconciliation_not_supported', '开发测试订单不需要向支付平台查单。')

    const notification = await paymentGateway.queryOrder(order.provider, {
      outTradeNo: order.out_trade_no,
      amountFen: Number(order.amount_fen),
      currency: order.currency,
    })
    await pool.query('UPDATE billing.orders SET last_reconciled_at = now(), updated_at = now() WHERE id = $1', [order.id])
    const result = await confirmNotification(order.provider, notification)
    if (!result.accepted) throw new BillingError(result.code || 'reconciliation_failed', result.message || '支付平台查单结果未通过订单校验。', 409)
    if (!notification.paid && ['closed', 'failed'].includes(notification.orderState)) {
      await pool.query(
        `UPDATE billing.orders
         SET status = $2, failure_code = $3, failure_message = $4, updated_at = now()
         WHERE id = $1 AND status IN ('pending', 'expired')`,
        [order.id, notification.orderState, `provider_${notification.orderState}`, notification.stateDescription || '支付平台确认订单未支付。'],
      )
    }
    return readOrder(userId, orderId)
  }

  async function recordRefund(orderId, reason = '') {
    const refundReason = String(reason || '管理员登记退款').trim().slice(0, 300)
    return withTransaction(async (client) => {
      const orderResult = await client.query('SELECT * FROM billing.orders WHERE id = $1 FOR UPDATE', [orderId])
      if (!orderResult.rowCount) throw new BillingError('order_not_found', '订单不存在。', 404)
      const order = orderResult.rows[0]
      if (order.status === 'refunded') {
        return { order: serializeOrder(order), membership: await readMembership(order.user_id, client), reused: true }
      }
      if (order.status !== 'paid') throw new BillingError('order_not_refundable', '只有已支付订单才能登记退款。', 409)

      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [order.user_id])
      const transactionNow = (await client.query('SELECT now() AS current_time')).rows[0].current_time
      const entitlementResult = await client.query(
        `SELECT * FROM billing.entitlements
         WHERE source_order_id = $1 AND status = 'active'
         FOR UPDATE`,
        [order.id],
      )
      const entitlement = entitlementResult.rows[0]
      if (entitlement) {
        const now = new Date(transactionNow)
        await client.query(
          `UPDATE billing.entitlements
           SET status = 'revoked', revoked_at = now(), revoke_reason = $2
           WHERE id = $1`,
          [entitlement.id, refundReason],
        )
        if (new Date(entitlement.ends_at).getTime() > now.getTime()) {
          const laterResult = await client.query(
            `SELECT id, starts_at, ends_at
             FROM billing.entitlements
             WHERE user_id = $1 AND status = 'active' AND starts_at >= $2
             ORDER BY starts_at ASC, created_at ASC
             FOR UPDATE`,
            [order.user_id, entitlement.ends_at],
          )
          const effectiveStart = new Date(entitlement.starts_at).getTime() < now.getTime() ? now : entitlement.starts_at
          const rebasedEntitlements = rebaseEntitlementSchedule(entitlement, laterResult.rows, effectiveStart)
          for (const later of rebasedEntitlements) {
            await client.query(
              'UPDATE billing.entitlements SET starts_at = $2, ends_at = $3 WHERE id = $1',
              [later.id, later.startsAt, later.endsAt],
            )
          }
        }
      }

      const updatedOrder = await client.query(
        `UPDATE billing.orders
         SET status = 'refunded', refunded_at = now(), refund_reason = $2, qr_payload = NULL, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [order.id, refundReason],
      )
      await client.query(
        `INSERT INTO billing.payment_events
           (provider, provider_event_id, out_trade_no, event_type, verified, payload)
         VALUES ($1, $2, $3, 'ADMIN.REFUND.RECORDED', true, $4::jsonb)
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [order.provider, `manual-refund:${order.id}`, order.out_trade_no, JSON.stringify({ reason: refundReason })],
      )
      return {
        order: serializeOrder(updatedOrder.rows[0]),
        membership: await readMembership(order.user_id, client),
        reused: false,
      }
    })
  }

  async function completeDevelopmentOrder(userId, orderId) {
    if (!paymentGateway.status().dev?.configured) throw new BillingError('dev_payment_disabled', '开发支付模拟未开启。', 404)
    const order = await findOrder(userId, orderId)
    if (order.provider !== 'dev') throw new BillingError('invalid_dev_order', '这不是开发测试订单。')
    if (order.status === 'paid') return readOrder(userId, orderId)
    if (order.status !== 'pending') throw new BillingError('order_not_payable', '订单已失效，请重新下单。')
    const result = await confirmNotification('dev', {
      providerEventId: `dev:${order.id}`,
      eventType: 'DEV.PAYMENT.SUCCESS',
      outTradeNo: order.out_trade_no,
      providerTradeNo: `DEV-${order.id}`,
      paid: true,
      amountFen: Number(order.amount_fen),
      currency: order.currency,
      payload: { simulated: true },
    })
    if (!result.accepted) throw new BillingError(result.code || 'dev_payment_failed', '开发测试支付未能完成。')
    return readOrder(userId, orderId)
  }

  return {
    listProducts,
    readMembership,
    listOrders,
    createOrder,
    readOrder,
    reconcileOrder,
    recordRefund,
    handleNotification,
    completeDevelopmentOrder,
  }
}
