CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE catalog.dishes
  ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dish_type varchar(40) NOT NULL DEFAULT '热菜',
  ADD COLUMN IF NOT EXISTS meal_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS license_type varchar(40) NOT NULL DEFAULT 'project_owned',
  ADD COLUMN IF NOT EXISTS evidence_level varchar(12) NOT NULL DEFAULT 'C'
    CHECK (evidence_level IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS review_status varchar(20) NOT NULL DEFAULT 'generated'
    CHECK (review_status IN ('verified', 'reviewed', 'generated', 'candidate')),
  ADD COLUMN IF NOT EXISTS nutrition_confidence varchar(20) NOT NULL DEFAULT 'estimated'
    CHECK (nutrition_confidence IN ('verified', 'source_estimate', 'estimated', 'unverified')),
  ADD COLUMN IF NOT EXISTS publication_status varchar(20) NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('published', 'candidate', 'hidden')),
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION catalog.refresh_dish_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := lower(concat_ws(' ',
    NEW.name,
    NEW.cuisine,
    NEW.method,
    NEW.dish_type,
    NEW.aliases::text,
    NEW.regions::text,
    NEW.taste::text,
    NEW.tags::text,
    NEW.ingredients::text
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_dish_search_text_trigger ON catalog.dishes;
CREATE TRIGGER catalog_dish_search_text_trigger
BEFORE INSERT OR UPDATE OF name, cuisine, method, dish_type, aliases, regions, taste, tags, ingredients
ON catalog.dishes
FOR EACH ROW EXECUTE FUNCTION catalog.refresh_dish_search_text();

UPDATE catalog.dishes
SET search_text = lower(concat_ws(' ', name, cuisine, method, dish_type, aliases::text,
  regions::text, taste::text, tags::text, ingredients::text));

CREATE TABLE IF NOT EXISTS catalog.dish_aliases (
  dish_id varchar(100) NOT NULL REFERENCES catalog.dishes(id) ON DELETE CASCADE,
  alias varchar(120) NOT NULL,
  normalized_alias varchar(120) NOT NULL,
  source varchar(40) NOT NULL DEFAULT 'catalog',
  PRIMARY KEY (dish_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS catalog.dish_sources (
  dish_id varchar(100) NOT NULL REFERENCES catalog.dishes(id) ON DELETE CASCADE,
  source_key varchar(80) NOT NULL,
  source_url text,
  license_type varchar(40) NOT NULL,
  attribution text,
  source_revision varchar(120),
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dish_id, source_key)
);

CREATE INDEX IF NOT EXISTS dishes_search_text_trgm_idx
  ON catalog.dishes USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dishes_name_trgm_idx
  ON catalog.dishes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dishes_regions_gin_idx
  ON catalog.dishes USING gin (regions);
CREATE INDEX IF NOT EXISTS dishes_type_idx
  ON catalog.dishes(dish_type, publication_status);
CREATE INDEX IF NOT EXISTS dishes_publication_cuisine_idx
  ON catalog.dishes(publication_status, cuisine, name);
CREATE INDEX IF NOT EXISTS dish_aliases_trgm_idx
  ON catalog.dish_aliases USING gin (normalized_alias gin_trgm_ops);

COMMENT ON COLUMN catalog.dishes.review_status IS 'Content confidence: verified, reviewed, generated, or candidate.';
COMMENT ON COLUMN catalog.dishes.nutrition_confidence IS 'Whether displayed nutrition is verified, source-estimated, internally estimated, or unavailable.';
COMMENT ON COLUMN catalog.dishes.publication_status IS 'Only published dishes are returned to ordinary clients.';
COMMENT ON TABLE catalog.dish_sources IS 'Per-dish provenance and commercial-use license ledger.';
