import * as Minio from 'minio'
import { config } from './config.mjs'

export const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
})

export async function ensureImageBucket() {
  const exists = await minioClient.bucketExists(config.minio.bucket)
  if (!exists) await minioClient.makeBucket(config.minio.bucket, config.minio.region)
}

export async function putImage(objectKey, buffer, metadata = {}) {
  return minioClient.putObject(config.minio.bucket, objectKey, buffer, buffer.length, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, max-age=31536000, immutable',
    ...metadata,
  })
}

export async function getSignedImageUrl(objectKey, expirySeconds = 3600) {
  return minioClient.presignedGetObject(config.minio.bucket, objectKey, expirySeconds)
}
