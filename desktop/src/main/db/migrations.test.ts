import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { openDatabase, type Db } from './connection'
import { SCHEMA_VERSION, migrate } from './migrations'

let dir: string
const opened: Db[] = []
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'auri-schema-quality-'))
})
afterEach(() => {
  for (const db of opened.splice(0)) if (db.open) db.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('compatibilidade do banco', () => {
  it('preserva os registros v1 ao migrar e reabrir', () => {
    const file = join(dir, 'v1.db')
    const legacy = new Database(file)
    opened.push(legacy)
    legacy.exec(readFileSync('docs/qualidade/fixtures/v1.sql', 'utf8'))
    legacy.close()

    const db = openDatabase(file)
    opened.push(db)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.prepare('SELECT id, nome, ativo FROM patients').all()).toEqual([
      { id: 77, nome: 'João Histórico Fictício', ativo: 0 }
    ])
    expect(
      db.prepare('SELECT id, patient_id, inicio, fim, observacao FROM appointments').all()
    ).toEqual([
      {
        id: 88,
        patient_id: 77,
        inicio: '2026-10-14T14:00',
        fim: '2026-10-14T15:00',
        observacao: 'Fixture v1'
      }
    ])
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(db.pragma('foreign_key_check')).toEqual([])
    db.close()

    const reopened = openDatabase(file)
    opened.push(reopened)
    expect(reopened.prepare('SELECT COUNT(*) AS n FROM patients').get()).toEqual({ n: 1 })
    expect(reopened.prepare('SELECT COUNT(*) AS n FROM appointments').get()).toEqual({ n: 1 })
  })

  it('recusa versão futura sem modificar o arquivo', () => {
    const file = join(dir, 'futuro.db')
    const db = new Database(file)
    opened.push(db)
    db.exec("CREATE TABLE sentinel (valor TEXT); INSERT INTO sentinel VALUES ('preservado');")
    db.pragma(`user_version = ${SCHEMA_VERSION + 1}`)
    const before = readFileSync(file)
    expect(() => migrate(db)).toThrow('O banco de dados é de uma versão mais nova do Auri')
    expect(readFileSync(file)).toEqual(before)
    expect(db.prepare('SELECT valor FROM sentinel').get()).toEqual({ valor: 'preservado' })
  })

  it('recusa a abertura de banco futuro sem mudar bytes nem criar WAL', () => {
    const file = join(dir, 'futuro-abertura.db')
    const future = new Database(file)
    future.exec("CREATE TABLE sentinel (valor TEXT); INSERT INTO sentinel VALUES ('preservado');")
    future.pragma(`user_version = ${SCHEMA_VERSION + 1}`)
    future.close()
    const before = readFileSync(file)
    expect(() => openDatabase(file)).toThrow('O banco de dados é de uma versão mais nova do Auri')
    expect(readFileSync(file)).toEqual(before)
    expect(readdirSync(dir)).toEqual(['futuro-abertura.db'])
  })
})
