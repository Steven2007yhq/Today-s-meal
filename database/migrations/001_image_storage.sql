CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS media;

CREATE TABLE IF NOT EXISTS media.dish_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id varchar(100) NOT NULL,
  sha256 char(64) NOT NULL,
  object_key text NOT NULL,
  thumbnail_key text NOT NULL,
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  mime_type varchar(40) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  source_url text,
  license_type varchar(80) NOT NULL,
  attribution text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (dish_id, sha256)
);

CREATE INDEX IF NOT EXISTS dish_images_dish_active_idx
  ON media.dish_images(dish_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS dish_images_hash_idx
  ON media.dish_images(sha256);

COMMENT ON TABLE media.dish_images IS 'MinIO object metadata; image binaries remain in private object storage.';
COMMENT ON COLUMN media.dish_images.license_type IS 'Required usage-right declaration such as user_provided_ai, cc_by, licensed_stock.';
