const DEFAULT_LIMIT = 36
const MAX_LIMIT = 60

function cleanFilter(value, maximum = 80) {
  return String(value || '').normalize('NFKC').trim().slice(0, maximum)
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export function normalizeCatalogListInput(input = {}) {
  return {
    query: cleanFilter(input.query ?? input.q, 80),
    cuisine: cleanFilter(input.cuisine, 40),
    region: cleanFilter(input.region, 40),
    dishType: cleanFilter(input.dishType, 40),
    page: positiveInteger(input.page, 1, 10_000),
    limit: positiveInteger(input.limit, DEFAULT_LIMIT, MAX_LIMIT),
  }
}

function serializeDish(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases || [],
    cuisine: row.cuisine,
    regions: row.regions || [],
    dishType: row.dish_type,
    mealTypes: row.meal_types || [],
    method: row.method,
    taste: row.taste || [],
    ingredients: row.ingredients || [],
    nutrition: row.nutrition || {},
    tags: row.tags || [],
    source: row.source,
    sourceUrl: row.source_url || null,
    licenseType: row.license_type,
    evidenceLevel: row.evidence_level,
    reviewStatus: row.review_status,
    nutritionConfidence: row.nutrition_confidence,
    updatedAt: row.updated_at,
  }
}

export function createCatalogService({ pool }) {
  async function listDishes(rawInput = {}) {
    const input = normalizeCatalogListInput(rawInput)
    const offset = (input.page - 1) * input.limit
    const values = [input.query, input.cuisine, input.region, input.dishType]
    const where = `
      publication_status = 'published'
      AND ($1 = '' OR search_text ILIKE '%' || $1 || '%' OR similarity(name, $1) >= 0.18)
      AND ($2 = '' OR cuisine = $2)
      AND ($3 = '' OR regions ? $3)
      AND ($4 = '' OR dish_type = $4)`
    const [countResult, dishResult] = await Promise.all([
      pool.query(`SELECT count(*)::integer AS total FROM catalog.dishes WHERE ${where}`, values),
      pool.query(
        `SELECT * FROM catalog.dishes
         WHERE ${where}
         ORDER BY
           CASE WHEN $1 = '' THEN 0 WHEN name = $1 THEN 4 WHEN name ILIKE $1 || '%' THEN 3
                WHEN search_text ILIKE '%' || $1 || '%' THEN 2 ELSE 1 END DESC,
           CASE WHEN $1 = '' THEN 0 ELSE similarity(name, $1) END DESC,
           evidence_level ASC,
           name ASC
         LIMIT $5 OFFSET $6`,
        [...values, input.limit, offset],
      ),
    ])
    const total = Number(countResult.rows[0]?.total || 0)
    return {
      dishes: dishResult.rows.map(serializeDish),
      pageInfo: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
        hasNextPage: offset + dishResult.rowCount < total,
      },
    }
  }

  async function readDish(dishId) {
    const result = await pool.query(
      `SELECT * FROM catalog.dishes
       WHERE id = $1 AND publication_status = 'published'
       LIMIT 1`,
      [dishId],
    )
    return serializeDish(result.rows[0])
  }

  async function readRelations(dishId, limit = 12) {
    const safeLimit = positiveInteger(limit, 12, 24)
    const result = await pool.query(
      `SELECT relation.score, relation.reason, target.*
       FROM catalog.dish_relations relation
       JOIN catalog.dishes target ON target.id = relation.target_id
       WHERE relation.source_id = $1 AND target.publication_status = 'published'
       ORDER BY relation.score DESC, target.name ASC
       LIMIT $2`,
      [dishId, safeLimit],
    )
    return {
      relations: result.rows.map((row) => ({
        ...serializeDish(row),
        relationScore: Math.round(Number(row.score) * 100),
        relationReason: row.reason,
      })),
    }
  }

  async function readFacets() {
    const [summary, relationSummary, cuisines, regions, dishTypes] = await Promise.all([
      pool.query(
        `SELECT count(*)::integer AS dishes,
                count(*) FILTER (WHERE review_status IN ('verified', 'reviewed'))::integer AS reviewed,
                count(*) FILTER (WHERE source <> 'internal_combination')::integer AS source_backed,
                count(*) FILTER (WHERE nutrition_confidence IN ('verified', 'source_estimate'))::integer AS nutrition_reviewed
         FROM catalog.dishes WHERE publication_status = 'published'`,
      ),
      pool.query('SELECT count(*)::integer AS relations FROM catalog.dish_relations'),
      pool.query(
        `SELECT cuisine AS value, count(*)::integer AS count
         FROM catalog.dishes WHERE publication_status = 'published'
         GROUP BY cuisine ORDER BY count(*) DESC, cuisine ASC`,
      ),
      pool.query(
        `SELECT region AS value, count(*)::integer AS count
         FROM catalog.dishes, jsonb_array_elements_text(regions) region
         WHERE publication_status = 'published'
         GROUP BY region ORDER BY count(*) DESC, region ASC`,
      ),
      pool.query(
        `SELECT dish_type AS value, count(*)::integer AS count
         FROM catalog.dishes WHERE publication_status = 'published'
         GROUP BY dish_type ORDER BY count(*) DESC, dish_type ASC`,
      ),
    ])
    return {
      summary: {
        dishes: Number(summary.rows[0]?.dishes || 0),
        reviewed: Number(summary.rows[0]?.reviewed || 0),
        sourceBacked: Number(summary.rows[0]?.source_backed || 0),
        nutritionReviewed: Number(summary.rows[0]?.nutrition_reviewed || 0),
        relations: Number(relationSummary.rows[0]?.relations || 0),
      },
      cuisines: cuisines.rows,
      regions: regions.rows,
      dishTypes: dishTypes.rows,
    }
  }

  return { listDishes, readDish, readRelations, readFacets }
}
