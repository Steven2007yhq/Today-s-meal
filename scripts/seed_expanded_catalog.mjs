import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { buildExpandedCatalog, buildTopRelations, catalogQualityReport, normalizeDishName } from './catalog_seed_lib.mjs'

const { Pool } = pg
const projectRoot = path.resolve(import.meta.dirname, '..')
const databaseUrl = process.env.DATABASE_URL || 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha'
const targetSize = Number(process.env.CATALOG_TARGET_SIZE || 5_000)
const relationLimit = Number(process.env.CATALOG_RELATION_LIMIT || 24)
const dryRun = process.argv.includes('--dry-run')
const reportPath = path.resolve(process.env.CATALOG_REPORT_PATH || path.join(projectRoot, 'output', 'catalog', 'catalog-quality-report.json'))

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'))
}

function valuesFromLibrary(library) {
  return Object.values(library?.dishHash || {})
}

function batch(values, size) {
  const groups = []
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size))
  return groups
}

function sourceRecord(dish) {
  if (dish.source === 'howtocook') {
    return {
      key: 'howtocook', url: dish.sourceUrl, license: 'Unlicense',
      attribution: 'Anduin2017/HowToCook contributors', revision: dish.sourceRevision || null,
    }
  }
  return {
    key: dish.source || 'project', url: dish.sourceUrl || null, license: dish.licenseType || 'project_owned',
    attribution: '好吃的今天产品团队', revision: null,
  }
}

async function loadCatalogInputs() {
  const [figure, figure2, crawled, howtocook] = await Promise.all([
    readJson('src/data/figureDishLibrary.json'),
    readJson('src/data/figure2DishLibrary.json'),
    readJson('src/data/crawledDishLibrary.json'),
    readJson('database/seeds/howtocook-recipes.json'),
  ])
  const { seasonalDishData } = await import('../src/data/seasonalDishData.mjs')
  return {
    coreDishes: [
      ...valuesFromLibrary(figure),
      ...valuesFromLibrary(figure2),
      ...valuesFromLibrary(crawled),
      ...seasonalDishData,
    ],
    openRecipes: howtocook.dishes || [],
  }
}

async function upsertDishes(client, dishes) {
  for (const group of batch(dishes, 100)) {
    const params = []
    const rows = group.map((dish, index) => {
      const offset = index * 18
      params.push(
        dish.id, dish.name, dish.cuisine, dish.method,
        JSON.stringify(dish.taste || []), JSON.stringify(dish.ingredients || []), JSON.stringify(dish.nutrition || {}), JSON.stringify(dish.tags || []),
        dish.source || 'project', JSON.stringify(dish.aliases || []), JSON.stringify(dish.regions || ['全国']), dish.dishType || '热菜',
        JSON.stringify(dish.mealTypes || []), dish.sourceUrl || null, dish.licenseType || 'project_owned', dish.evidenceLevel || 'C',
        dish.reviewStatus || 'generated', dish.nutritionConfidence || 'estimated',
      )
      return `(${Array.from({ length: 18 }, (_, column) => `$${offset + column + 1}`).join(',')})`
    })
    await client.query(
      `INSERT INTO catalog.dishes
        (id, name, cuisine, method, taste, ingredients, nutrition, tags, source, aliases, regions, dish_type,
         meal_types, source_url, license_type, evidence_level, review_status, nutrition_confidence)
       VALUES ${rows.join(',')}
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuisine = EXCLUDED.cuisine, method = EXCLUDED.method,
         taste = EXCLUDED.taste, ingredients = EXCLUDED.ingredients, nutrition = EXCLUDED.nutrition, tags = EXCLUDED.tags,
         source = EXCLUDED.source, aliases = EXCLUDED.aliases, regions = EXCLUDED.regions, dish_type = EXCLUDED.dish_type,
         meal_types = EXCLUDED.meal_types, source_url = EXCLUDED.source_url, license_type = EXCLUDED.license_type,
         evidence_level = EXCLUDED.evidence_level, review_status = EXCLUDED.review_status,
         nutrition_confidence = EXCLUDED.nutrition_confidence, publication_status = 'published', updated_at = now()`,
      params,
    )
  }
}

async function replaceAliases(client, dishes) {
  const aliases = dishes.flatMap((dish) => (dish.aliases || []).map((alias) => ({
    dishId: dish.id, alias, normalized: normalizeDishName(alias), source: dish.source || 'catalog',
  }))).filter((item) => item.normalized)
  await client.query('DELETE FROM catalog.dish_aliases WHERE dish_id = ANY($1::varchar[])', [dishes.map((dish) => dish.id)])
  for (const group of batch(aliases, 500)) {
    const params = []
    const rows = group.map((item, index) => {
      const offset = index * 4
      params.push(item.dishId, item.alias, item.normalized, item.source)
      return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4})`
    })
    await client.query(`INSERT INTO catalog.dish_aliases (dish_id, alias, normalized_alias, source) VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`, params)
  }
}

async function replaceSources(client, dishes) {
  await client.query('DELETE FROM catalog.dish_sources WHERE dish_id = ANY($1::varchar[])', [dishes.map((dish) => dish.id)])
  for (const group of batch(dishes, 250)) {
    const params = []
    const rows = group.map((dish, index) => {
      const source = sourceRecord(dish)
      const offset = index * 6
      params.push(dish.id, source.key, source.url, source.license, source.attribution, source.revision)
      return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6})`
    })
    await client.query(
      `INSERT INTO catalog.dish_sources (dish_id, source_key, source_url, license_type, attribution, source_revision)
       VALUES ${rows.join(',')} ON CONFLICT (dish_id, source_key) DO UPDATE SET source_url = EXCLUDED.source_url,
       license_type = EXCLUDED.license_type, attribution = EXCLUDED.attribution, source_revision = EXCLUDED.source_revision, checked_at = now()`,
      params,
    )
  }
}

async function replaceRelations(client, dishes, relations) {
  const dishIds = dishes.map((dish) => dish.id)
  await client.query('DELETE FROM catalog.dish_relations WHERE source_id = ANY($1::varchar[]) OR target_id = ANY($1::varchar[])', [dishIds])
  for (const group of batch(relations, 500)) {
    const params = []
    const rows = group.map((relation, index) => {
      const offset = index * 4
      params.push(relation.sourceId, relation.targetId, relation.score, relation.reason)
      return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4})`
    })
    await client.query(
      `INSERT INTO catalog.dish_relations (source_id, target_id, score, reason) VALUES ${rows.join(',')}
       ON CONFLICT (source_id, target_id) DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
      params,
    )
  }
}

const inputs = await loadCatalogInputs()
const dishes = buildExpandedCatalog({ ...inputs, targetSize })
const relations = buildTopRelations(dishes, relationLimit)
const report = {
  generatedAt: new Date().toISOString(),
  targetSize,
  relationLimit,
  ...catalogQualityReport(dishes, relations),
}
await fs.mkdir(path.dirname(reportPath), { recursive: true })
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

if (report.total !== targetSize || report.uniqueNames !== targetSize || report.duplicateNames.length || report.maxRelationsPerDish > relationLimit) {
  throw new Error(`目录质量门禁未通过：${JSON.stringify(report)}`)
}

if (!dryRun) {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await upsertDishes(client, dishes)
    await replaceAliases(client, dishes)
    await replaceSources(client, dishes)
    await replaceRelations(client, dishes, relations)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

console.log(`${dryRun ? 'Catalog dry run' : 'Catalog seeded'}: ${report.total} dishes, ${report.relations} directed relations, ${report.reviewed} reviewed, ${report.generated} generated.`)
console.log(`Quality report: ${reportPath}`)
