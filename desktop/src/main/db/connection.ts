import Database from 'better-sqlite3'
import { normalizeText } from '../../shared/search'
import { migrate } from './migrations'

export type Db = Database.Database

export function openDatabase(file: string): Db {
  const db = new Database(file)
  try {
    db.pragma('foreign_keys = ON')
    db.function('normalize_text', { deterministic: true }, (v: unknown) =>
      normalizeText(typeof v === 'string' ? v : null)
    )
    migrate(db)
    db.pragma('journal_mode = WAL')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
