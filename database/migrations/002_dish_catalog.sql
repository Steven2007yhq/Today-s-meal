CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE IF NOT EXISTS catalog.dishes (
  id varchar(100) PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  cuisine varchar(40) NOT NULL,
  method varchar(60) NOT NULL,
  taste jsonb NOT NULL DEFAULT '[]',
  ingredients jsonb NOT NULL DEFAULT '[]',
  nutrition jsonb NOT NULL DEFAULT '{}',
  tags jsonb NOT NULL DEFAULT '[]',
  source varchar(40) NOT NULL DEFAULT 'curated',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog.dish_relations (
  source_id varchar(100) NOT NULL REFERENCES catalog.dishes(id) ON DELETE CASCADE,
  target_id varchar(100) NOT NULL REFERENCES catalog.dishes(id) ON DELETE CASCADE,
  score numeric(8, 5) NOT NULL,
  reason varchar(160) NOT NULL,
  PRIMARY KEY (source_id, target_id),
  CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS dishes_cuisine_idx ON catalog.dishes(cuisine);
CREATE INDEX IF NOT EXISTS dish_relations_source_score_idx ON catalog.dish_relations(source_id, score DESC);

COMMENT ON TABLE catalog.dishes IS 'Searchable dish metadata; binaries remain in MinIO and media.dish_images.';
COMMENT ON TABLE catalog.dish_relations IS 'Directed weighted dish graph derived from ingredients, cuisine, taste, and cooking method.';
