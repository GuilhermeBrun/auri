import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import type postgres from 'postgres'

export type Migration = { version: string; sql: string }

const FILE = /^(\d{3}_[a-z0-9_]+)\.sql$/

const checksum = (sql: string): string => createHash('sha256').update(sql).digest('hex')

export function loadMigrations(dir = new URL('./migracoes/', import.meta.url)): Migration[] {
  return readdirSync(dir)
    .filter((file) => FILE.test(file))
    .sort()
    .map((file) => ({
      version: FILE.exec(file)![1]!,
      sql: readFileSync(new URL(file, dir), 'utf8')
    }))
}

export async function migrate(
  sql: postgres.Sql,
  migrations: Migration[] = loadMigrations()
): Promise<string[]> {
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('auri_schema_migrations'))`
    await tx`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `
    const rows = await tx<{ version: string; checksum: string }[]>`
      SELECT version, checksum FROM schema_migrations
    `
    const done = new Map(rows.map((row) => [row.version, row.checksum]))
    const applied: string[] = []
    for (const migration of migrations) {
      const sum = checksum(migration.sql)
      const previous = done.get(migration.version)
      if (previous !== undefined) {
        if (previous !== sum)
          throw new Error(
            `A migração ${migration.version} mudou depois de aplicada. Crie uma nova migração em vez de editar esta.`
          )
        continue
      }
      await tx.unsafe(migration.sql)
      await tx`INSERT INTO schema_migrations (version, checksum) VALUES (${migration.version}, ${sum})`
      applied.push(migration.version)
    }
    return applied
  }) as Promise<string[]>
}
