import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import {
  createAppointment,
  getAppointment,
  listPatientAppointments,
  PRESENCA_SO_ASSINADA,
  updateAppointment
} from './appointments'
import { openDatabase, type Db } from './connection'
import { createPatient } from './patients'

let db: Db
let patientId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' }).id
})

const slot = (inicio: string, fim: string) => ({
  patient_id: patientId,
  inicio,
  fim,
  observacao: ''
})

describe('registro da sessão', () => {
  it('agendar sem registro grava sessão comum, sem presença nem evolução', () => {
    const a = createAppointment(db, slot('2025-09-08T14:00', '2025-09-08T14:30'))
    expect(a).toMatchObject({
      tipo_nome: 'Sessão',
      categoria: 'sessao',
      presenca: '',
      evolucao: ''
    })
  })

  it('grava tipo, presença e evolução e os devolve na edição', () => {
    const a = createAppointment(db, {
      ...slot('2025-08-29T14:00', '2025-08-29T15:00'),
      tipo_id: 2
    })
    const saved = updateAppointment(
      db,
      a.id,
      {
        ...slot(a.inicio, a.fim),
        tipo_id: 2,
        presenca: 'falta',
        evolucao: 'Avaliação inicial'
      },
      a.updated_at
    )
    expect(saved).toMatchObject({
      tipo_nome: 'Avaliação',
      categoria: 'avaliacao',
      presenca: 'falta',
      evolucao: 'Avaliação inicial'
    })
    expect(getAppointment(db, a.id).evolucao).toBe('Avaliação inicial')
  })

  it('presente só pela assinatura da chegada', () => {
    const input = slot('2025-09-08T14:00', '2025-09-08T14:30')
    expect(() => createAppointment(db, { ...input, presenca: 'presente' })).toThrow(
      PRESENCA_SO_ASSINADA
    )
    const a = createAppointment(db, input)
    expect(() =>
      updateAppointment(db, a.id, { ...slot(a.inicio, a.fim), presenca: 'presente' }, a.updated_at)
    ).toThrow(PRESENCA_SO_ASSINADA)
    db.prepare("UPDATE appointments SET presenca = 'presente' WHERE id = ?").run(a.id)
    const legado = getAppointment(db, a.id)
    expect(
      updateAppointment(
        db,
        a.id,
        { ...slot(a.inicio, a.fim), presenca: 'presente', evolucao: 'Sessão boa' },
        legado.updated_at
      )
    ).toMatchObject({ presenca: 'presente', evolucao: 'Sessão boa' })
  })

  it('recusa presença ou tipo desconhecidos', () => {
    expect(() =>
      createAppointment(db, {
        ...slot('2025-09-08T14:00', '2025-09-08T14:30'),
        presenca: 'talvez' as never
      })
    ).toThrow()
  })

  it('lista o histórico do paciente da sessão mais nova para a mais antiga', () => {
    const other = createPatient(db, { ...emptyPatientInput(), nome: 'Outro Fictício' }).id
    createAppointment(db, slot('2025-09-08T14:00', '2025-09-08T14:30'))
    createAppointment(db, slot('2025-09-15T14:00', '2025-09-15T14:30'))
    createAppointment(db, { ...slot('2025-09-10T09:00', '2025-09-10T09:30'), patient_id: other })
    expect(listPatientAppointments(db, patientId).map((a) => a.inicio)).toEqual([
      '2025-09-15T14:00',
      '2025-09-08T14:00'
    ])
  })
})

describe('migração do registro da sessão', () => {
  it('sessões do banco v1 viram sessões comuns sem registro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'auri-sessions-'))
    try {
      const file = join(dir, 'v1.db')
      const legacy = new Database(file)
      legacy.exec(readFileSync('docs/qualidade/fixtures/v1.sql', 'utf8'))
      legacy.close()
      const migrated = openDatabase(file)
      expect(getAppointment(migrated, 88)).toMatchObject({
        tipo_nome: 'Sessão',
        categoria: 'sessao',
        presenca: '',
        evolucao: '',
        observacao: 'Fixture v1'
      })
      migrated.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
