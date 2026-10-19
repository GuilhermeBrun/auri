import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { openDatabase, type Db } from './connection'
import { DatabaseTooNewError, SCHEMA_VERSION, migrate } from './migrations'

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
    expect(db.prepare('SELECT celular, pai_cpf, resp_tipo, resp_nome FROM patients').get()).toEqual(
      { celular: null, pai_cpf: null, resp_tipo: null, resp_nome: null }
    )
    expect(() => db.prepare("UPDATE patients SET resp_tipo = 'avo'").run()).toThrow(/CHECK/)
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(db.pragma('foreign_key_check')).toEqual([])
    db.close()

    const reopened = openDatabase(file)
    opened.push(reopened)
    expect(reopened.prepare('SELECT COUNT(*) AS n FROM patients').get()).toEqual({ n: 1 })
    expect(reopened.prepare('SELECT COUNT(*) AS n FROM appointments').get()).toEqual({ n: 1 })
  })

  it('converte a série escrita à mão e guarda o que não entende', () => {
    const file = join(dir, 'serie.db')
    const legacy = new Database(file)
    opened.push(legacy)
    legacy.exec(readFileSync('docs/qualidade/fixtures/v1.sql', 'utf8'))
    const insert = legacy.prepare(
      "INSERT INTO patients (id, nome, serie, updated_at) VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z')"
    )
    insert.run(1, 'Ana', '3 ano')
    insert.run(2, 'Bia', '2ª Série do Ensino Médio')
    insert.run(3, 'Caio', 'Maternal II')
    insert.run(4, 'Davi', null)
    legacy.close()

    const db = openDatabase(file)
    opened.push(db)
    expect(
      db
        .prepare(
          'SELECT id, serie, serie_numero, serie_tipo, serie_etapa, updated_at FROM patients WHERE id < 10 ORDER BY id'
        )
        .all()
    ).toEqual([
      {
        id: 1,
        serie: null,
        serie_numero: '3',
        serie_tipo: 'ano',
        serie_etapa: null,
        updated_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        serie: null,
        serie_numero: '2',
        serie_tipo: 'serie',
        serie_etapa: 'medio',
        updated_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 3,
        serie: 'Maternal II',
        serie_numero: null,
        serie_tipo: null,
        serie_etapa: null,
        updated_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 4,
        serie: null,
        serie_numero: null,
        serie_tipo: null,
        serie_etapa: null,
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ])
  })

  it('apaga as atividades junto com o paciente e recusa dia ou horário fora do formato', () => {
    const db = openDatabase(':memory:')
    opened.push(db)
    db.prepare("INSERT INTO patients (id, nome) VALUES (1, 'Ana')").run()
    const insert = db.prepare(
      'INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim) VALUES (?, ?, ?, ?, ?)'
    )
    insert.run(1, 'Natação', 2, '14:00', '15:00')
    expect(() => insert.run(1, 'Balé', 7, '14:00', '15:00')).toThrow(/CHECK/)
    expect(() => insert.run(1, 'Balé', 3, '15:00', '14:00')).toThrow(/CHECK/)
    expect(() => insert.run(99, 'Balé', 3, '14:00', '15:00')).toThrow(/FOREIGN KEY/)
    db.prepare('DELETE FROM patients WHERE id = 1').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM patient_activities').get()).toEqual({ n: 0 })
  })

  it('recusa versão futura sem modificar o arquivo', () => {
    const file = join(dir, 'futuro.db')
    const db = new Database(file)
    opened.push(db)
    db.exec("CREATE TABLE sentinel (valor TEXT); INSERT INTO sentinel VALUES ('preservado');")
    db.pragma(`user_version = ${SCHEMA_VERSION + 1}`)
    const before = readFileSync(file)
    expect(() => migrate(db)).toThrow(DatabaseTooNewError)
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
