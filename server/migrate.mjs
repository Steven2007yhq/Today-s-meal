import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationDirectory = path.resolve(currentDirectory, '../database/migrations')

// Concurrent `npm run db:migrate` runs block on this instead of racing.
const MIGRATION_LOCK_ID = 4_012_025

const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`

function checksumOf(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex')
}

async function readMigrationFiles() {
  const fileNames = (await fs.readdir(migrationDirectory)).filter((fileName) => fileName.endsWith('.sql')).sort()
  return Promise.all(fileNames.map(async (fileName) => {
    const sql = await fs.readFile(path.join(migrationDirectory, fileName), 'utf8')
    return { fileName, sql, checksum: checksumOf(sql) }
  }))
}

// Each file runs inside its own transaction, so a failure leaves the schema at
// the last fully applied migration instead of half-way through a broken one.
// A migration needing a statement that cannot run in a transaction block (for
// example CREATE INDEX CONCURRENTLY) has to be handled separately.
async function applyMigration(client, { fileName, sql, checksum }) {
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query(
      'INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)',
      [fileName, checksum],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw new Error(`迁移 ${fileName} 执行失败，已回滚：${error.message}`, { cause: error })
  }
}

async function migrate() {
  const client = await pool.connect()
  let lockAcquired = false
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    lockAcquired = true
    await client.query(LEDGER_DDL)

    const ledgerResult = await client.query('SELECT filename, checksum FROM public.schema_migrations')
    const appliedChecksums = new Map(ledgerResult.rows.map((row) => [row.filename, row.checksum]))
    const migrations = await readMigrationFiles()

    let appliedCount = 0
    for (const migration of migrations) {
      const previousChecksum = appliedChecksums.get(migration.fileName)
      if (previousChecksum === migration.checksum) continue
      if (previousChecksum) {
        throw new Error(
          `迁移 ${migration.fileName} 在应用之后被改动过（校验和不匹配）。`
          + '已应用的迁移必须保持只读，请新增一个迁移文件来表达这次变更。',
        )
      }
      await applyMigration(client, migration)
      console.log(`Applied: ${migration.fileName}`)
      appliedCount += 1
    }
    console.log(appliedCount
      ? `Migrations complete: ${appliedCount} applied, ${migrations.length - appliedCount} already up to date.`
      : `Migrations complete: nothing to apply, all ${migrations.length} already up to date.`)
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {})
    }
    client.release()
    await pool.end()
  }
}

try {
  await migrate()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
