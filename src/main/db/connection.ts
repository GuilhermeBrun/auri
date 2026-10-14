import Database from 'better-sqlite3'
import { normalizeText } from '../../shared/search'
import { migrate } from './migrations'

export type Db = Database.Database

export function openDatabase(file: string): Db {
  const db = new Database(file)
  try {
    db.pragma('foreign_keys = ON')
    // ordem alfabética que ignora acentos ("Ágata" junto de "Agata")
    db.function('normalize_text', { deterministic: true }, (v: unknown) =>
      normalizeText(typeof v === 'string' ? v : null)
    )
    // Recusar uma versão futura antes de mudar o modo de journaling preserva
    // o arquivo recebido e evita criar WAL/SHM durante uma abertura recusada.
    migrate(db)
    db.pragma('journal_mode = WAL')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
