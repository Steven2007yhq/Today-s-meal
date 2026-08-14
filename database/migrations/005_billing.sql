CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE IF NOT EXISTS billing.products (
  code varchar(40) PRIMARY KEY,
  name varchar(80) NOT NULL,
  description varchar(240) NOT NULL DEFAULT '',
  amount_fen integer NOT NULL CHECK (amount_fen > 0),
  currency char(3) NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO billing.products
  (code, name, description, amount_fen, duration_days, active, sort_order)
VALUES
  ('pro_month', 'Pro 饭搭子月度会员', '家庭、乐龄、健身场景及小饭 AI 专属饮食建议', 2999, 31, true, 10),
  ('pro_year', 'Pro 饭搭子年度会员', '家庭、乐龄、健身场景及小饭 AI 专属饮食建议', 19999, 366, true, 20)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_fen = EXCLUDED.amount_fen,
  duration_days = EXCLUDED.duration_days,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS billing.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  out_trade_no varchar(32) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  product_code varchar(40) NOT NULL REFERENCES billing.products(code) ON DELETE RESTRICT,
  provider varchar(20) NOT NULL CHECK (provider IN ('wechat', 'alipay', 'dev')),
  amount_fen integer NOT NULL CHECK (amount_fen > 0),
  currency char(3) NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'closed', 'expired', 'refunded')),
  idempotency_key varchar(80) NOT NULL,
  provider_trade_no varchar(96),
  qr_payload text,
  failure_code varchar(80),
  failure_message varchar(300),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_orders_provider_trade_unique
  ON billing.orders(provider, provider_trade_no)
  WHERE provider_trade_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_orders_user_created_idx
  ON billing.orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_orders_pending_expiry_idx
  ON billing.orders(expires_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS billing.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(20) NOT NULL CHECK (provider IN ('wechat', 'alipay', 'dev')),
  provider_event_id varchar(160) NOT NULL,
  out_trade_no varchar(32) NOT NULL,
  event_type varchar(60) NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS billing_payment_events_order_idx
  ON billing.payment_events(out_trade_no, created_at DESC);

CREATE TABLE IF NOT EXISTS billing.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind varchar(30) NOT NULL DEFAULT 'pro' CHECK (kind = 'pro'),
  source_order_id uuid NOT NULL UNIQUE REFERENCES billing.orders(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_entitlements_user_active_idx
  ON billing.entitlements(user_id, ends_at DESC)
  WHERE status = 'active';

