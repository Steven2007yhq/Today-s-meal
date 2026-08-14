ALTER TABLE billing.products
  ADD COLUMN IF NOT EXISTS billing_period varchar(12) NOT NULL DEFAULT 'day'
    CHECK (billing_period IN ('day', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS billing_period_count smallint NOT NULL DEFAULT 1
    CHECK (billing_period_count > 0);

UPDATE billing.products
SET billing_period = CASE code
      WHEN 'pro_month' THEN 'month'
      WHEN 'pro_year' THEN 'year'
      ELSE billing_period
    END,
    billing_period_count = 1,
    updated_at = now()
WHERE code IN ('pro_month', 'pro_year');

ALTER TABLE billing.orders
  ADD COLUMN IF NOT EXISTS product_name varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 1
    CHECK (duration_days > 0),
  ADD COLUMN IF NOT EXISTS billing_period varchar(12) NOT NULL DEFAULT 'day'
    CHECK (billing_period IN ('day', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS billing_period_count smallint NOT NULL DEFAULT 1
    CHECK (billing_period_count > 0),
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason varchar(300);

UPDATE billing.orders order_row
SET product_name = product.name,
    duration_days = product.duration_days,
    billing_period = product.billing_period,
    billing_period_count = product.billing_period_count
FROM billing.products product
WHERE product.code = order_row.product_code
  AND order_row.product_name = '';

ALTER TABLE billing.entitlements
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_reason varchar(300);

CREATE INDEX IF NOT EXISTS billing_orders_user_status_created_idx
  ON billing.orders(user_id, status, created_at DESC);
