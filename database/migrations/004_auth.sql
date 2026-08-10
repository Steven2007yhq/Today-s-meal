CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(40) NOT NULL DEFAULT '小饭同学',
  avatar_url text,
  gender varchar(20),
  password_hash text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS gender varchar(20);

CREATE TABLE IF NOT EXISTS identity.login_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  provider varchar(20) NOT NULL CHECK (provider IN ('phone', 'email_163', 'email_qq', 'wechat', 'qq')),
  provider_subject_hash char(64) NOT NULL,
  identifier_hint varchar(120),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject_hash)
);

ALTER TABLE identity.login_identities
  ADD COLUMN IF NOT EXISTS identifier_hint varchar(120);

CREATE INDEX IF NOT EXISTS login_identities_user_idx
  ON identity.login_identities(user_id);

CREATE TABLE IF NOT EXISTS identity.verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash char(64) NOT NULL,
  purpose varchar(20) NOT NULL CHECK (purpose IN ('register', 'login', 'reset_password')),
  code_hash char(64) NOT NULL,
  captcha_token_hash char(64) NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS verification_challenges_lookup_idx
  ON identity.verification_challenges(subject_hash, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS identity.sessions (
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

CREATE INDEX IF NOT EXISTS sessions_user_idx
  ON identity.sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sessions_active_idx
  ON identity.sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;
