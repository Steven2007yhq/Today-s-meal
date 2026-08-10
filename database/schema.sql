-- PostgreSQL 15+ production schema. Sensitive identity data and module profiles are logically separated.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS meal;
CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(40) NOT NULL DEFAULT '小饭同学',
  avatar_url text,
  gender varchar(20),
  password_hash text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE identity.login_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  provider varchar(20) NOT NULL CHECK (provider IN ('phone', 'email_163', 'email_qq', 'wechat', 'qq')),
  provider_subject_hash text NOT NULL,
  identifier_hint varchar(120),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject_hash)
);

CREATE TABLE identity.verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash text NOT NULL,
  purpose varchar(20) NOT NULL,
  code_hash text NOT NULL,
  captcha_token_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE identity.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address inet
);

CREATE INDEX sessions_user_idx ON identity.sessions(user_id, created_at DESC);
CREATE INDEX sessions_active_idx ON identity.sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE profile.base_profiles (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  age_range varchar(20),
  biological_sex varchar(20),
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  activity_level smallint CHECK (activity_level BETWEEN 0 AND 3),
  dietary_goals text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  dislikes text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  cooking_minutes_target smallint,
  budget_level smallint CHECK (budget_level BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES profile.households(id) ON DELETE CASCADE,
  anonymous_role varchar(24) NOT NULL,
  age_range varchar(20) NOT NULL,
  biological_sex varchar(20),
  portion_factor numeric(3,2) NOT NULL DEFAULT 1,
  allergies text[] NOT NULL DEFAULT '{}',
  dislikes text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE profile.elder_profiles (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  chewing_level varchar(20),
  swallowing_risk boolean NOT NULL DEFAULT false,
  chronic_conditions text[] NOT NULL DEFAULT '{}',
  medication_notes_encrypted bytea,
  sodium_limit_mg integer,
  clinician_notes_encrypted bytea,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile.fitness_profiles (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  goal varchar(20) CHECK (goal IN ('fat_loss', 'muscle_gain', 'maintenance', 'performance')),
  target_weight_kg numeric(5,2),
  target_body_fat numeric(4,2),
  weekly_training_days smallint,
  training_schedule jsonb NOT NULL DEFAULT '{}',
  macro_strategy jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meal.meal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  eaten_on date NOT NULL,
  meal_type varchar(20) NOT NULL,
  title varchar(120) NOT NULL,
  eaten_at time,
  source varchar(20) NOT NULL DEFAULT 'manual',
  calories_kcal numeric(8,2),
  protein_g numeric(7,2),
  carbs_g numeric(7,2),
  fat_g numeric(7,2),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meal_entries_user_date_idx ON meal.meal_entries(user_id, eaten_on DESC);

CREATE TABLE meal.meal_entry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_entry_id uuid NOT NULL REFERENCES meal.meal_entries(id) ON DELETE CASCADE,
  food_name varchar(100) NOT NULL,
  amount_g numeric(8,2),
  household_measure varchar(40),
  nutrition_snapshot jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE meal.weekly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  module varchar(20) NOT NULL CHECK (module IN ('standard', 'family', 'elder', 'fitness')),
  week_start date NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}',
  ai_model varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, week_start)
);

CREATE TABLE meal.nutrition_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  grade varchar(4),
  metrics jsonb NOT NULL,
  suggestions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meal.favorite_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key_hash text NOT NULL,
  name varchar(60) NOT NULL,
  color varchar(20) NOT NULL DEFAULT '#e96f45',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_key_hash, name)
);

CREATE TABLE meal.favorite_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key_hash text NOT NULL,
  collection_id uuid NOT NULL REFERENCES meal.favorite_collections(id) ON DELETE CASCADE,
  dish_id varchar(100) NOT NULL REFERENCES catalog.dishes(id) ON DELETE CASCADE,
  note varchar(160) NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_key_hash, dish_id)
);

CREATE INDEX favorite_collections_owner_idx ON meal.favorite_collections(owner_key_hash, created_at DESC);
CREATE INDEX favorite_dishes_owner_idx ON meal.favorite_dishes(owner_key_hash, created_at DESC);
CREATE INDEX favorite_dishes_collection_idx ON meal.favorite_dishes(collection_id, created_at DESC);

CREATE TABLE billing.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  plan varchar(20) NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status varchar(20) NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  provider varchar(20) CHECK (provider IN ('wechat_pay', 'alipay')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id),
  membership_id uuid REFERENCES billing.memberships(id),
  merchant_order_no varchar(64) NOT NULL UNIQUE,
  provider varchar(20) NOT NULL,
  amount_fen integer NOT NULL CHECK (amount_fen > 0),
  status varchar(20) NOT NULL,
  provider_transaction_id varchar(128),
  webhook_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE analytics.module_usage_daily (
  usage_date date NOT NULL,
  module varchar(20) NOT NULL,
  registered_users integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  plans_generated integer NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_date, module)
);

CREATE TABLE analytics.ai_audit_log (
  id bigserial PRIMARY KEY,
  user_id_hash text NOT NULL,
  module varchar(20) NOT NULL,
  intent varchar(40),
  food_scope_passed boolean NOT NULL,
  model varchar(80),
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
