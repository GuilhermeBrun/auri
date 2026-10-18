import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { runOperation } from '../operations'
import { openDatabase, type Db } from './connection'
import { createPatient, getPatient, updatePatient } from './patients'

let directory: string
let db: Db
const opened: Db[] = []
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'auri-storage-quality-'))
  db = openDatabase(join(directory, 'dados.db'))
  opened.push(db)
})
afterEach(() => {
  for (const connection of opened.splice(0)) if (connection.open) connection.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('falhas de armazenamento', () => {
  it('recusa escrita somente leitura sem perder o registro nem anunciar sucesso', () => {
    const patient = createPatient(db, { ...emptyPatientInput(), nome: 'João Preservado Fictício' })
    db.pragma('query_only = ON')
    const changed = vi.fn()
    const result = runOperation(
      db,
      'patients:update',
      [patient.id, { ...emptyPatientInput(), nome: 'Não gravar' }],
      changed
    )
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/readonly/i) })
    expect(changed).not.toHaveBeenCalled()
    expect(getPatient(db, patient.id)).toEqual(patient)
    db.close()
    const reopened = openDatabase(join(directory, 'dados.db'))
    opened.push(reopened)
    expect(getPatient(reopened, patient.id)).toEqual(patient)
  })
  it('mantém os dados quando outro escritor bloqueia o banco e permite tentar novamente', () => {
    const patient = createPatient(db, { ...emptyPatientInput(), nome: 'Ana Bloqueio Fictício' })
    const writer = openDatabase(join(directory, 'dados.db'))
    opened.push(writer)
    db.pragma('busy_timeout = 1')
    writer.exec('BEGIN IMMEDIATE')
    const input = { ...emptyPatientInput(), nome: 'Ana Atualizada Fictícia' }
    expect(() => updatePatient(db, patient.id, input)).toThrow(/locked/i)
    expect(getPatient(db, patient.id)).toEqual(patient)
    writer.exec('ROLLBACK')
    expect(updatePatient(db, patient.id, input).nome).toBe(input.nome)
  })
  it('recusa falta de espaço sem aplicar parcialmente a atualização', () => {
    const patient = createPatient(db, { ...emptyPatientInput(), nome: 'Carlos Espaço Fictício' })
    const pages = db.pragma('page_count', { simple: true }) as number
    db.pragma(`max_page_count = ${pages}`)
    expect(() =>
      updatePatient(db, patient.id, {
        ...emptyPatientInput(),
        nome: 'Não gravar',
        observacoes: 'x'.repeat(1024 * 1024)
      })
    ).toThrow(/full/i)
    expect(getPatient(db, patient.id)).toEqual(patient)
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
  })
})
