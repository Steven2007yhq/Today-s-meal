CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS meal;

CREATE TABLE IF NOT EXISTS meal.favorite_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key_hash text NOT NULL,
  name varchar(60) NOT NULL,
  color varchar(20) NOT NULL DEFAULT '#e96f45',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_key_hash, name)
);

CREATE TABLE IF NOT EXISTS meal.favorite_dishes (
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

CREATE INDEX IF NOT EXISTS favorite_collections_owner_idx ON meal.favorite_collections(owner_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS favorite_dishes_owner_idx ON meal.favorite_dishes(owner_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS favorite_dishes_collection_idx ON meal.favorite_dishes(collection_id, created_at DESC);
