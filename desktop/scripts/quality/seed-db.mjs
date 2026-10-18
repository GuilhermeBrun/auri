import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
const db = new Database(process.argv[2])
try {
  db.exec(readFileSync('docs/qualidade/fixtures/v1.sql', 'utf8'))
} finally {
  db.close()
}
