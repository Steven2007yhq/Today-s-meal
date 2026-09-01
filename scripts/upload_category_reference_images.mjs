import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const manifestPath = path.resolve(process.env.CATEGORY_REFERENCE_MANIFEST || path.join(import.meta.dirname, 'category_reference_manifest.json'))
const imageDirectory = path.resolve(process.argv.slice(2).find((argument) => !argument.startsWith('--'))
  || process.env.CATEGORY_REFERENCE_IMAGE_DIR
  || path.join(projectRoot, 'figure', 'category-reference-2026-08-25'))
const apiBaseUrl = process.env.IMAGE_API_URL || process.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'
const uploadToken = process.env.IMAGE_UPLOAD_TOKEN || 'replace-this-development-token'
const dryRun = process.argv.includes('--dry-run')
const concurrency = Math.max(1, Math.min(6, Number(process.env.CATEGORY_UPLOAD_CONCURRENCY) || 4))
const manifestBatch = path.basename(manifestPath).match(/(20\d{6})/)?.[1] || '20260825'
const collection = process.env.CATEGORY_REFERENCE_COLLECTION || `category-reference-${manifestBatch}`
const attributionDate = `${manifestBatch.slice(0, 4)}-${manifestBatch.slice(4, 6)}-${manifestBatch.slice(6, 8)}`
const mimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
])

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
if (!Array.isArray(manifest) || !manifest.length) throw new Error('Category reference manifest is empty.')

const ids = new Set()
const files = new Set()
for (const entry of manifest) {
  if (!entry.id || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(entry.id)) throw new Error(`Invalid category reference id: ${entry.id}`)
  if (!entry.file || !mimeTypes.has(path.extname(entry.file).toLowerCase())) throw new Error(`Invalid category reference file: ${entry.file}`)
  if (!entry.name || !entry.method || !entry.dishType || !Array.isArray(entry.ingredients)) throw new Error(`Incomplete visual profile: ${entry.id}`)
  if (ids.has(entry.id)) throw new Error(`Duplicate category reference id: ${entry.id}`)
  if (files.has(entry.file)) throw new Error(`Duplicate category reference file: ${entry.file}`)
  ids.add(entry.id)
  files.add(entry.file)
}

const missingFiles = []
for (const entry of manifest) {
  try {
    await fs.access(path.join(imageDirectory, entry.file))
  } catch {
    missingFiles.push(entry.file)
  }
}
if (missingFiles.length) throw new Error(`Missing ${missingFiles.length} category reference images: ${missingFiles.join(', ')}`)

if (dryRun) {
  console.log(`Category reference images ready: ${manifest.length} files in ${imageDirectory}`)
  process.exit(0)
}

let uploadedCount = 0
let deduplicatedCount = 0
let nextIndex = 0
const failures = []

async function uploadEntry(entry, index) {
  const filePath = path.join(imageDirectory, entry.file)
  const fileBuffer = await fs.readFile(filePath)
  const mimeType = mimeTypes.get(path.extname(entry.file).toLowerCase())
  const formData = new FormData()
  formData.append('dishId', entry.id)
  formData.append('licenseType', 'user_provided_ai')
  formData.append('attribution', `用户提供的菜品类别基准图（${attributionDate}）`)
  formData.append('originalFileName', entry.file)
  formData.append('collection', collection)
  formData.append('visualName', entry.name)
  formData.append('visualCuisine', entry.cuisine || '家常菜')
  formData.append('visualMethod', entry.method)
  formData.append('visualDishType', entry.dishType)
  formData.append('visualIngredients', JSON.stringify(entry.ingredients))
  formData.append('visualTaste', JSON.stringify(entry.taste || []))
  formData.append('image', new Blob([fileBuffer], { type: mimeType }), entry.file)

  const response = await fetch(`${apiBaseUrl}/api/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${uploadToken}` },
    body: formData,
  })
  if (!response.ok) throw new Error(`upload failed (${response.status}): ${await response.text()}`)

  const payload = await response.json()
  if (payload.deduplicated) deduplicatedCount += 1
  else uploadedCount += 1
  console.log(`[${index + 1}/${manifest.length}] ${payload.deduplicated ? 'Deduplicated' : 'Uploaded'} ${entry.name} -> ${entry.id}`)
}

async function uploadWorker() {
  while (nextIndex < manifest.length) {
    const index = nextIndex
    nextIndex += 1
    const entry = manifest[index]
    try {
      await uploadEntry(entry, index)
    } catch (error) {
      failures.push({ entry, message: error instanceof Error ? error.message : String(error) })
      console.error(`[${index + 1}/${manifest.length}] Failed ${entry.name}`)
    }
  }
}

console.log(`Uploading ${manifest.length} category reference images from ${imageDirectory} with concurrency ${concurrency}...`)
await Promise.all(Array.from({ length: concurrency }, () => uploadWorker()))
console.log(`Finished: ${uploadedCount} uploaded, ${deduplicatedCount} deduplicated, ${failures.length} failed.`)

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure.entry.name}: ${failure.message}`)
  process.exitCode = 1
}
