import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { seasonalDishData } from '../src/data/seasonalDishData.mjs'

const { Pool } = pg
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDirectory, '..')
const imageDirectory = path.join(projectRoot, 'src', 'assets', 'dishes', 'seasonal')
const apiBaseUrl = process.env.IMAGE_API_URL || process.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'
const uploadToken = process.env.IMAGE_UPLOAD_TOKEN || 'replace-this-development-token'
const databaseUrl = process.env.DATABASE_URL || 'postgresql://mealapp:mealapp_dev_password@127.0.0.1:55432/jintianchisha'

const pantryIngredients = new Set(['食用油', '生姜', '小葱', '食盐', '酱油', '白糖', '淀粉', '大蒜'])

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function relationReason(leftDish, rightDish) {
  const rightIngredients = new Set((rightDish.ingredients || []).map((item) => item.name))
  const shared = (leftDish.ingredients || []).map((item) => item.name).filter((name) => !pantryIngredients.has(name) && rightIngredients.has(name))
  if (shared.length) return `共用${shared.slice(0, 2).join('、')}`
  if (leftDish.method === rightDish.method) return `同为${leftDish.method}`
  const sharedTaste = (leftDish.taste || []).find((taste) => (rightDish.taste || []).includes(taste))
  return sharedTaste ? `同属${sharedTaste}风味` : `同属${leftDish.cuisine}`
}

function relationScore(leftDish, rightDish) {
  const leftIngredients = new Set((leftDish.ingredients || []).map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const rightIngredients = new Set((rightDish.ingredients || []).map((item) => item.name).filter((name) => !pantryIngredients.has(name)))
  const intersection = [...leftIngredients].filter((name) => rightIngredients.has(name)).length
  const union = new Set([...leftIngredients, ...rightIngredients]).size
  return clamp(
    Math.max(0.05, (union ? intersection / union : 0) * 1.5
      + (leftDish.method === rightDish.method ? 0.28 : 0)
      + ((leftDish.taste || []).some((taste) => (rightDish.taste || []).includes(taste)) ? 0.22 : 0)
      + (leftDish.cuisine === rightDish.cuisine ? 0.22 : 0)),
    0,
    2.5,
  )
}

async function uploadDishImage(dish) {
  const fileBuffer = await fs.readFile(path.join(imageDirectory, dish.imageFile))
  const formData = new FormData()
  formData.append('dishId', dish.id)
  formData.append('licenseType', 'user_provided_ai')
  formData.append('attribution', '用户提供的新菜图片（节日/西式新增）')
  formData.append('originalFileName', dish.imageFile)
  formData.append('collection', 'seasonal')
  formData.append('image', new Blob([fileBuffer], { type: 'image/png' }), dish.imageFile)

  const response = await fetch(`${apiBaseUrl}/api/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${uploadToken}` },
    body: formData,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${dish.imageFile} upload failed (${response.status}): ${detail}`)
  }
  const payload = await response.json()
  return payload.deduplicated ? 'deduplicated' : 'uploaded'
}

const pool = new Pool({ connectionString: databaseUrl })
const client = await pool.connect()

let uploadedCount = 0
let deduplicatedCount = 0

try {
  for (const dish of seasonalDishData) {
    const outcome = await uploadDishImage(dish)
    if (outcome === 'deduplicated') deduplicatedCount += 1
    else uploadedCount += 1
  }

  await client.query('BEGIN')

  for (const dish of seasonalDishData) {
    await client.query(
      `INSERT INTO catalog.dishes (id, name, cuisine, method, taste, ingredients, nutrition, tags, source, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuisine = EXCLUDED.cuisine, method = EXCLUDED.method,
         taste = EXCLUDED.taste, ingredients = EXCLUDED.ingredients, nutrition = EXCLUDED.nutrition,
         tags = EXCLUDED.tags, source = EXCLUDED.source, updated_at = now()`,
      [dish.id, dish.name, dish.cuisine, dish.method, JSON.stringify(dish.taste), JSON.stringify(dish.ingredients), JSON.stringify(dish.nutrition), JSON.stringify(dish.tags), dish.source],
    )
  }

  const catalogRows = await client.query(
    `SELECT id, name, cuisine, method, taste, ingredients
     FROM catalog.dishes
     ORDER BY cuisine, name`,
  )
  const allDishes = catalogRows.rows
  const seasonalIds = seasonalDishData.map((dish) => dish.id)
  await client.query('DELETE FROM catalog.dish_relations WHERE source_id = ANY($1::varchar[]) OR target_id = ANY($1::varchar[])', [seasonalIds])

  const relations = []
  for (const leftDish of seasonalDishData) {
    for (const rightDish of allDishes) {
      if (leftDish.id === rightDish.id) continue
      const score = relationScore(leftDish, rightDish)
      const reason = relationReason(leftDish, rightDish)
      relations.push({
        sourceId: leftDish.id,
        targetId: rightDish.id,
        score: Number(score.toFixed(5)),
        reason,
      })
    }
  }

  for (const relation of relations) {
    await client.query(
      `INSERT INTO catalog.dish_relations (source_id, target_id, score, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_id, target_id) DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
      [relation.sourceId, relation.targetId, relation.score, relation.reason],
    )
  }

  await client.query('COMMIT')
  console.log(`Seasonal sync done: ${uploadedCount} uploaded, ${deduplicatedCount} deduplicated, ${seasonalDishData.length} dishes, ${relations.length} directed relations.`)
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
