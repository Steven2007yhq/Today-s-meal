CREATE SCHEMA IF NOT EXISTS app;

-- Collections are per user; the desktop client sends an anonymous install key.
CREATE TABLE IF NOT EXISTS app.favorite_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key varchar(80) NOT NULL,
  name varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_key, name)
);

-- dish_name is denormalised on purpose: favourites must still render when the
-- catalog row is missing, e.g. a curated dish that only exists in the frontend.
CREATE TABLE IF NOT EXISTS app.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key varchar(80) NOT NULL,
  dish_id varchar(100) NOT NULL,
  dish_name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_key, dish_id)
);

CREATE TABLE IF NOT EXISTS app.favorite_collection_items (
  favorite_id uuid NOT NULL REFERENCES app.favorites(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES app.favorite_collections(id) ON DELETE CASCADE,
  PRIMARY KEY (favorite_id, collection_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON app.favorites(user_key, created_at DESC);
CREATE INDEX IF NOT EXISTS favorite_collections_user_created_idx ON app.favorite_collections(user_key, created_at);
CREATE INDEX IF NOT EXISTS favorite_collection_items_collection_idx ON app.favorite_collection_items(collection_id);
