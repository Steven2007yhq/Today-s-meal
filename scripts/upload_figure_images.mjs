import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const figureRoot = process.env.FIGURE_IMAGE_DIR || path.join(os.homedir(), 'Desktop', '今天吃啥', 'figure')
const folderName = process.argv[2] || 'figure1'
// figure1 keeps the original 'figure' collection tag so rows uploaded before the folder split stay addressable.
const imageCollection = process.argv[3] || (folderName === 'figure1' ? 'figure' : folderName)
const imageDirectory = path.isAbsolute(folderName) ? folderName : path.resolve(figureRoot, folderName)
const apiBaseUrl = process.env.IMAGE_API_URL || process.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'
const uploadToken = process.env.IMAGE_UPLOAD_TOKEN || 'replace-this-development-token'
const concurrency = Math.max(1, Math.min(8, Number(process.env.FIGURE_UPLOAD_CONCURRENCY) || 5))
const mimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
])

const directoryEntries = await fs.readdir(imageDirectory, { withFileTypes: true })
const imageFiles = directoryEntries
  .filter((entry) => entry.isFile() && mimeTypes.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((first, second) => first.localeCompare(second, 'zh-CN'))

if (!imageFiles.length) throw new Error(`No supported images found in ${imageDirectory}`)

let uploadedCount = 0
let deduplicatedCount = 0
let nextIndex = 0
const failures = []

async function uploadImage(fileName, index) {
  const filePath = path.join(imageDirectory, fileName)
  const fileBuffer = await fs.readFile(filePath)
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const dishId = `figure-${sha256.slice(0, 24)}`
  const mimeType = mimeTypes.get(path.extname(fileName).toLowerCase())
  const formData = new FormData()
  formData.append('dishId', dishId)
  formData.append('licenseType', 'user_provided_ai')
  formData.append('attribution', `用户提供的 ${imageCollection} 家常菜图片`)
  formData.append('originalFileName', fileName)
  formData.append('collection', imageCollection)
  formData.append('image', new Blob([fileBuffer], { type: mimeType }), fileName)

  const response = await fetch(`${apiBaseUrl}/api/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${uploadToken}` },
    body: formData,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`upload failed (${response.status}): ${detail}`)
  }

  const payload = await response.json()
  if (payload.deduplicated) deduplicatedCount += 1
  else uploadedCount += 1
  console.log(`[${index + 1}/${imageFiles.length}] ${payload.deduplicated ? 'Deduplicated' : 'Uploaded'} ${fileName} -> ${dishId}`)
}

async function uploadWorker() {
  while (nextIndex < imageFiles.length) {
    const index = nextIndex
    nextIndex += 1
    const fileName = imageFiles[index]
    try {
      await uploadImage(fileName, index)
    } catch (error) {
      failures.push({ fileName, message: error instanceof Error ? error.message : String(error) })
      console.error(`[${index + 1}/${imageFiles.length}] Failed ${fileName}`)
    }
  }
}

console.log(`Uploading ${imageFiles.length} images from ${imageDirectory} with concurrency ${concurrency}...`)
await Promise.all(Array.from({ length: concurrency }, () => uploadWorker()))
console.log(`Finished: ${uploadedCount} uploaded, ${deduplicatedCount} deduplicated, ${failures.length} failed.`)

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure.fileName}: ${failure.message}`)
  process.exitCode = 1
}
