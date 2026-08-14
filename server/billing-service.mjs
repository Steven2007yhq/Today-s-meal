import crypto from 'node:crypto'

const ORDER_IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9._:-]{8,80}$/
const SUPPORTED_PROVIDERS = new Set(['wechat', 'alipay', 'dev'])

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
  }
}

function serializeOrder(row) {
  return {
    id: row.id,
    outTradeNo: row.out_trade_no,
    productCode: row.product_code,
    productName: row.product_name,
    provider: row.provider,
    amountFen: Number(row.amount_fen),
    currency: row.currency,
    status: row.status,
    qrPayload: row.status === 'pending' ? row.qr_payload : null,
    failureCode: row.failure_code || null,
    failureMessage: row.failure_message || null,
    expiresAt: row.expires_at,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
  }
}

function serializeMembership(row) {
  const validUntil = row?.valid_until || null
  return {
    isPro: Boolean(validUntil && new Date(validUntil).getTime() > Date.now()),
    plan: validUntil ? 'pro' : 'free',
    validUntil,
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
      `SELECT code, name, description, amount_fen, currency, duration_days
       FROM billing.products
       WHERE active = true
       ORDER BY sort_order ASC, amount_fen ASC`,
    )
    return { products: result.rows.map(serializeProduct), providers: paymentGateway.status() }
  }

  async function readMembership(userId, client = pool) {
    const result = await client.query(
      `SELECT max(ends_at) AS valid_until
       FROM billing.entitlements
       WHERE user_id = $1 AND kind = 'pro' AND status = 'active' AND ends_at > now()`,
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
      `SELECT order_row.*, product.name AS product_name
       FROM billing.orders order_row
       JOIN billing.products product ON product.code = order_row.product_code
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

  async function createOrder({ userId, productCode, provider, idempotencyKey }) {
    if (!SUPPORTED_PROVIDERS.has(provider)) throw new BillingError('unsupported_provider', '请选择可用的支付方式。')
    if (!ORDER_IDEMPOTENCY_PATTERN.test(String(idempotencyKey || ''))) {
      throw new BillingError('invalid_idempotency_key', '订单请求标识无效，请刷新后重试。')
    }
    const providerState = paymentGateway.status()[provider]
    if (!providerState?.configured) throw new BillingError('provider_not_configured', '该支付通道尚未配置，请稍后再试。', 503)

    const existing = await pool.query(
      `SELECT order_row.*, product.name AS product_name
       FROM billing.orders order_row
       JOIN billing.products product ON product.code = order_row.product_code
       WHERE order_row.user_id = $1 AND order_row.idempotency_key = $2
       LIMIT 1`,
      [userId, idempotencyKey],
    )
    if (existing.rowCount) return { order: serializeOrder(existing.rows[0]), reused: true }

    const productResult = await pool.query(
      `SELECT code, name, description, amount_fen, currency, duration_days
       FROM billing.products WHERE code = $1 AND active = true LIMIT 1`,
      [productCode],
    )
    if (!productResult.rowCount) throw new BillingError('product_not_found', '会员商品不存在或已下架。', 404)
    const product = productResult.rows[0]
    const expiresAt = new Date(Date.now() + Math.max(5, Math.min(60, orderTtlMinutes)) * 60_000)
    const insert = await pool.query(
      `INSERT INTO billing.orders
         (out_trade_no, user_id, product_code, provider, amount_fen, currency, idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [createOutTradeNo(), userId, product.code, provider, product.amount_fen, product.currency, idempotencyKey, expiresAt],
    )
    if (!insert.rowCount) {
      const raced = await pool.query(
        `SELECT order_row.*, product.name AS product_name
         FROM billing.orders order_row JOIN billing.products product ON product.code = order_row.product_code
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
         RETURNING *, $3::text AS product_name`,
        [order.id, providerOrder.qrPayload, product.name],
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
        `SELECT order_row.*, product.duration_days, product.name AS product_name
         FROM billing.orders order_row
         JOIN billing.products product ON product.code = order_row.product_code
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
      if (!['pending', 'expired'].includes(order.status)) return { accepted: false, code: 'order_not_payable' }

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
      await client.query(
        `INSERT INTO billing.entitlements (user_id, source_order_id, starts_at, ends_at)
         VALUES ($1, $2, $3, $3::timestamptz + make_interval(days => $4))
         ON CONFLICT (source_order_id) DO NOTHING`,
        [order.user_id, order.id, startsAt, Number(order.duration_days)],
      )
      return { accepted: true, paid: true, userId: order.user_id, duplicate: duplicateEvent }
    })
  }

  async function handleNotification(provider, request) {
    const notification = await paymentGateway.parseNotification(provider, request)
    return confirmNotification(provider, notification)
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

  return { listProducts, readMembership, createOrder, readOrder, handleNotification, completeDevelopmentOrder }
}
