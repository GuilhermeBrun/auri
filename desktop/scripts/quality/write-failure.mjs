import Database from 'better-sqlite3'
const db = new Database(process.argv[2])
try {
  db.exec(
    process.argv[3] === 'enable'
      ? "CREATE TRIGGER quality_refuse_write BEFORE UPDATE ON patients BEGIN SELECT RAISE(ABORT, 'Falha de gravação de teste'); END;"
      : 'DROP TRIGGER quality_refuse_write'
  )
} finally {
  db.close()
}
