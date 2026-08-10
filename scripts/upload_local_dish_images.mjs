import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDirectory, '..')
const imageDirectory = path.join(projectRoot, 'src/assets/dishes')
const apiBaseUrl = process.env.IMAGE_API_URL || process.env.VITE_IMAGE_API_URL || 'http://127.0.0.1:8787'
const uploadToken = process.env.IMAGE_UPLOAD_TOKEN || 'replace-this-development-token'

const imageMappings = [
  ['mapo-doufu.jpg', 'chuan-mapo-doufu'],
  ['gongbao-jiding.jpg', 'chuan-gongbao-jiding'],
  ['shuizhu-yu.jpg', 'chuan-shuizhu-yu'],
  ['baiqie-ji.jpg', 'yue-baiqie-ji'],
  ['fuqifeipian.jpg', 'chuan-fuqifeipian'],
  ['mizhichashao.jpg', 'yue-mizhichashao'],
  ['guangshi-kaoruzhu.jpg', 'yue-guangshi-kaoruzhu'],
  ['qingzheng-shibanyu.jpg', 'yue-qingzheng-shibanyu'],
  ['congba-haishen.jpg', 'lu-congshao-haishen'],
  ['jiuzhuan-dachang.jpg', 'lu-jiuzhuan-dachang'],
]

let uploadedCount = 0
let deduplicatedCount = 0

for (const [fileName, dishId] of imageMappings) {
  const fileBuffer = await fs.readFile(path.join(imageDirectory, fileName))
  const formData = new FormData()
  formData.append('dishId', dishId)
  formData.append('licenseType', 'user_provided_ai')
  formData.append('attribution', '豆包AI生成（用户提供，保留原图标识）')
  formData.append('image', new Blob([fileBuffer], { type: 'image/jpeg' }), fileName)

  const response = await fetch(`${apiBaseUrl}/api/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${uploadToken}` },
    body: formData,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${fileName} upload failed (${response.status}): ${detail}`)
  }
  const payload = await response.json()
  if (payload.deduplicated) deduplicatedCount += 1
  else uploadedCount += 1
  console.log(`${payload.deduplicated ? 'Deduplicated' : 'Uploaded'} ${fileName} -> ${dishId}`)
}

console.log(`Finished: ${uploadedCount} uploaded, ${deduplicatedCount} deduplicated.`)
