import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from './connection'
import { createPatient, listPatients as queryPatients } from './patients'
import { restoreDatabase } from './recovery'
import { createKeyring } from '../backup/archive'
import { createBackup, extractBackup } from '../backup/backup'

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>()
  return { ...fs, renameSync: vi.fn(fs.renameSync) }
})
vi.mock('./connection', async (original) => {
  const connection = await original<typeof import('./connection')>()
  return { ...connection, openDatabase: vi.fn(connection.openDatabase) }
})
const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs')
const actualConnection = await vi.importActual<typeof import('./connection')>('./connection')
let directory: string
let file: string
let source: string
let db: Db
const listPatients = (database: Db, incluirInativos = false) =>
  queryPatients(database, { busca: '', incluirInativos })

beforeEach(() => {
  vi.mocked(renameSync).mockImplementation(actualFs.renameSync)
  vi.mocked(openDatabase).mockImplementation(actualConnection.openDatabase)
  directory = mkdtempSync(join(tmpdir(), 'auri-recovery-'))
  file = join(directory, 'auri.db')
  source = join(directory, 'historico.db')
  db = openDatabase(file)
  createPatient(db, { ...emptyPatientInput(), nome: 'Paciente atual fictício' })
  const historical = new Database(source)
  historical.exec(readFileSync('docs/qualidade/fixtures/v1.sql', 'utf8'))
  historical.close()
})
afterEach(() => {
  if (db.open) db.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('recuperação de dados', () => {
  it('restaura a fixture histórica sem perder IDs, campos ou agendamentos', () => {
    const originalSource = readFileSync(source)
    db = restoreDatabase(db, file, source)
    expect(listPatients(db, true)).toEqual([
      expect.objectContaining({ id: 77, nome: 'João Histórico Fictício', ativo: false })
    ])
    expect(db.prepare('SELECT id, patient_id, inicio, fim FROM appointments').all()).toEqual([
      { id: 88, patient_id: 77, inicio: '2026-10-14T14:00', fim: '2026-10-14T15:00' }
    ])
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(readFileSync(source)).toEqual(originalSource)
    expect(readdirSync(directory).filter((name) => name.includes('.restore-'))).toEqual([])
  })

  it('recusa arquivo ausente ou truncado mantendo o banco atual aberto', () => {
    expect(() => restoreDatabase(db, file, join(directory, 'ausente.db'))).toThrow()
    writeFileSync(source, 'SQLite format 3\0incompleto')
    expect(() => restoreDatabase(db, file, source)).toThrow()
    expect(db.open).toBe(true)
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
  })

  it('recusa versão futura sem modificar a origem ou os dados atuais', () => {
    const future = new Database(source)
    future.pragma('user_version = 999')
    future.close()
    const bytes = readFileSync(source)
    expect(() => restoreDatabase(db, file, source)).toThrow('incompatível')
    expect(readFileSync(source)).toEqual(bytes)
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
  })

  it('recusa banco vazio e tabela incompatível antes da substituição', () => {
    rmSync(source)
    const invalid = new Database(source)
    invalid.pragma('foreign_keys = OFF')
    invalid.pragma('user_version = 1')
    invalid.close()
    expect(() => restoreDatabase(db, file, source)).toThrow()
    const unversioned = new Database(source)
    unversioned.pragma('user_version = 0')
    unversioned.close()
    expect(() => restoreDatabase(db, file, source)).toThrow('incompatível')
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
  })

  it('recusa relações órfãs mesmo quando o SQLite passa no integrity_check', () => {
    const invalid = new Database(source)
    invalid.pragma('foreign_keys = OFF')
    invalid.prepare('UPDATE appointments SET patient_id = 999 WHERE id = 88').run()
    invalid.close()
    expect(() => restoreDatabase(db, file, source)).toThrow('referências inválidas')
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
  })

  it('recusa o próprio banco como origem', () => {
    expect(() => restoreDatabase(db, file, file)).toThrow('outro arquivo')
    expect(db.open).toBe(true)
  })

  it('falha na promoção preserva todos os dados e permite nova tentativa', () => {
    vi.mocked(renameSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('Arquivo ocupado'), { code: 'EBUSY' })
    })
    expect(() => restoreDatabase(db, file, source)).toThrow('Arquivo ocupado')
    db = openDatabase(file)
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
    db = restoreDatabase(db, file, source)
    expect(listPatients(db, true)[0].id).toBe(77)
  })

  it('falha ao abrir a cópia promovida repõe o banco anterior', () => {
    vi.mocked(openDatabase)
      .mockImplementationOnce(actualConnection.openDatabase)
      .mockImplementationOnce(() => {
        throw new Error('Falha ao abrir a cópia')
      })
    expect(() => restoreDatabase(db, file, source)).toThrow('Falha ao abrir a cópia')
    db = openDatabase(file)
    expect(listPatients(db)[0].nome).toBe('Paciente atual fictício')
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(readdirSync(directory).filter((name) => name.includes('.restore-'))).toEqual([])
  })

  it('leitor externo impede a troca e mantém os dados recentes no WAL', () => {
    const reader = new Database(file, { readonly: true })
    try {
      reader.exec('BEGIN')
      reader.prepare('SELECT count(*) FROM patients').get()
      createPatient(db, { ...emptyPatientInput(), nome: 'Gravação recente fictícia' })
      db.pragma('busy_timeout = 1')
      expect(() => restoreDatabase(db, file, source)).toThrow('em uso')
      expect(db.open).toBe(true)
      expect(listPatients(db)).toHaveLength(2)
    } finally {
      reader.exec('ROLLBACK')
      reader.close()
    }
  })

  it('falha também no rollback conserva uma cópia legível dos dados anteriores', () => {
    vi.mocked(openDatabase)
      .mockImplementationOnce(actualConnection.openDatabase)
      .mockImplementationOnce(() => {
        throw new Error('Falha na abertura')
      })
    vi.mocked(renameSync)
      .mockImplementationOnce(actualFs.renameSync)
      .mockImplementationOnce(() => {
        throw new Error('Falha no rollback')
      })
    expect(() => restoreDatabase(db, file, source)).toThrow('cópia anterior foi preservada')
    const previous = readdirSync(directory).find((name) => name.endsWith('.previous'))!
    expect(previous).toBeTruthy()
    const preserved = openDatabase(join(directory, previous))
    expect(listPatients(preserved)[0].nome).toBe('Paciente atual fictício')
    preserved.close()
  })

  it('restaura um backup cifrado histórico e reabre a base recuperada', async () => {
    const historical = openDatabase(source)
    const keyring = await createKeyring('Senha Fictícia', 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ', {
      N: 1024,
      r: 8,
      p: 1
    })
    const backup = await createBackup({
      db: historical,
      folder: join(directory, 'copias'),
      keyring,
      tmpDir: join(directory, 'tmp')
    })
    historical.close()
    const extracted = join(directory, 'extraido.db')
    await extractBackup(backup.file, keyring.key, extracted)
    db = restoreDatabase(db, file, extracted)
    db.close()
    db = openDatabase(file)
    expect(listPatients(db, true)[0].id).toBe(77)
    expect(db.prepare('SELECT count(*) AS n FROM appointments').get()).toEqual({ n: 1 })
    const corrupt = Buffer.from(readFileSync(backup.file))
    corrupt[corrupt.length - 1] ^= 1
    writeFileSync(backup.file, corrupt)
    await expect(extractBackup(backup.file, keyring.key, extracted)).rejects.toThrow()
    expect(listPatients(db, true)[0].id).toBe(77)
  })
})
