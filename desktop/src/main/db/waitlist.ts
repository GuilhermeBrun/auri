import { PERIODOS, type Periodo } from '../../shared/encaixe'
import {
  waitlistAddSchema,
  waitlistCloseSchema,
  waitlistInputSchema,
  type WaitlistAdd,
  type WaitlistClose,
  type WaitlistEntry,
  type WaitlistInput
} from '../../shared/waitlist'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type WaitlistRow = Omit<WaitlistEntry, 'dias' | 'periodos' | 'observacao'> & {
  dias: string
  periodos: string
  observacao: string | null
  encerrado_em: string | null
}

const SELECT = `
  SELECT w.id, w.patient_id, p.nome AS patient_nome, w.tipo, w.duracao, w.dias, w.periodos,
         w.prioridade, w.observacao, w.encerrado_em, w.created_at, w.updated_at
  FROM waitlist_entries w
  JOIN patients p ON p.id = w.patient_id`

const ORDER = `ORDER BY w.prioridade = 'alta' DESC, w.created_at, w.id`

function fromRow({ encerrado_em: _, ...row }: WaitlistRow): WaitlistEntry {
  return {
    ...row,
    dias: row.dias === '' ? [] : row.dias.split(',').map(Number),
    periodos: row.periodos
      .split(',')
      .filter((p): p is Periodo => (PERIODOS as readonly string[]).includes(p)),
    observacao: row.observacao ?? ''
  }
}

function toParams(input: WaitlistInput): Record<string, string | number | null> {
  const full = waitlistInputSchema.parse(input)
  return {
    tipo: full.tipo,
    duracao: full.duracao,
    dias: full.dias.join(','),
    periodos: full.periodos.join(','),
    prioridade: full.prioridade,
    observacao: full.observacao === '' ? null : full.observacao
  }
}

function getOpenEntry(db: Db, id: number): WaitlistEntry {
  const row = db.prepare(`${SELECT} WHERE w.id = ?`).get(id) as WaitlistRow | undefined
  if (!row) throw new Error('Paciente não está na lista de espera')
  if (row.encerrado_em !== null) throw new Error('Este paciente já saiu da lista de espera')
  return fromRow(row)
}

export function listWaitlist(db: Db): WaitlistEntry[] {
  const rows = db
    .prepare(`${SELECT} WHERE w.encerrado_em IS NULL AND p.ativo = 1 ${ORDER}`)
    .all() as WaitlistRow[]
  return rows.map(fromRow)
}

export function getPatientWaitlist(db: Db, patientId: number): WaitlistEntry | null {
  const row = db
    .prepare(`${SELECT} WHERE w.patient_id = ? AND w.encerrado_em IS NULL`)
    .get(patientId) as WaitlistRow | undefined
  return row ? fromRow(row) : null
}

export function addToWaitlist(db: Db, input: WaitlistAdd): WaitlistEntry {
  const { patient_id } = waitlistAddSchema.parse(input)
  const patient = db.prepare('SELECT ativo FROM patients WHERE id = ?').get(patient_id) as
    | { ativo: number }
    | undefined
  if (!patient) throw new Error('Paciente não encontrado')
  if (!patient.ativo) throw new Error('Reative o paciente antes de pôr na lista de espera')
  if (getPatientWaitlist(db, patient_id)) {
    throw new Error('Este paciente já está na lista de espera')
  }
  const result = db
    .prepare(
      `INSERT INTO waitlist_entries (patient_id, tipo, duracao, dias, periodos, prioridade, observacao)
       VALUES (@patient_id, @tipo, @duracao, @dias, @periodos, @prioridade, @observacao)`
    )
    .run({ ...toParams(input), patient_id })
  return getOpenEntry(db, Number(result.lastInsertRowid))
}

export function updateWaitlist(
  db: Db,
  id: number,
  input: WaitlistInput,
  expected?: string
): WaitlistEntry {
  assertUnchanged(getOpenEntry(db, id).updated_at, expected)
  db.prepare(
    `UPDATE waitlist_entries
     SET tipo = @tipo, duracao = @duracao, dias = @dias, periodos = @periodos,
         prioridade = @prioridade, observacao = @observacao,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = @id`
  ).run({ ...toParams(input), id })
  return getOpenEntry(db, id)
}

export function closeWaitlist(db: Db, id: number, close: WaitlistClose): void {
  const parsed = waitlistCloseSchema.parse(close)
  const entry = getOpenEntry(db, id)
  const appointmentId = parsed.motivo === 'agendado' ? parsed.appointment_id : null
  if (appointmentId !== null) {
    const appointment = db
      .prepare('SELECT patient_id FROM appointments WHERE id = ?')
      .get(appointmentId) as { patient_id: number } | undefined
    if (!appointment) throw new Error('Agendamento não encontrado')
    if (appointment.patient_id !== entry.patient_id) {
      throw new Error('Esse agendamento é de outro paciente')
    }
  }
  db.prepare(
    `UPDATE waitlist_entries
     SET encerrado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), encerrado_motivo = @motivo,
         appointment_id = @appointment_id, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = @id`
  ).run({ id, motivo: parsed.motivo, appointment_id: appointmentId })
}
