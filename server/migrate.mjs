import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationDirectory = path.resolve(currentDirectory, '../database/migrations')

try {
  const migrationFiles = (await fs.readdir(migrationDirectory)).filter((fileName) => fileName.endsWith('.sql')).sort()
  for (const migrationFile of migrationFiles) {
    const migrationSql = await fs.readFile(path.join(migrationDirectory, migrationFile), 'utf8')
    await pool.query(migrationSql)
    console.log(`Migration completed: ${migrationFile}`)
  }
} finally {
  await pool.end()
}
