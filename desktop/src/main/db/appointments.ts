import { formatTime, parseIsoLocalDateTime } from '../../shared/dates'
import {
  appointmentInputSchema,
  type Appointment,
  type AppointmentInput
} from '../../shared/schemas'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type AppointmentRow = Omit<Appointment, 'observacao' | 'presenca' | 'evolucao'> & {
  observacao: string | null
  presenca: Appointment['presenca'] | null
  evolucao: string | null
}

const SELECT = `
  SELECT a.id, a.patient_id, a.inicio, a.fim, a.observacao, a.tipo, a.presenca, a.evolucao,
         a.created_at, a.updated_at, p.nome AS patient_nome
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id`

function fromRow(row: AppointmentRow): Appointment {
  return {
    ...row,
    observacao: row.observacao ?? '',
    presenca: row.presenca ?? '',
    evolucao: row.evolucao ?? ''
  }
}

const orNull = (value: string): string | null => (value === '' ? null : value)

function toParams(input: AppointmentInput): Record<string, string | number | null> {
  const full = appointmentInputSchema.parse(input)
  return {
    patient_id: full.patient_id,
    inicio: full.inicio,
    fim: full.fim,
    observacao: orNull(full.observacao),
    tipo: full.tipo,
    presenca: orNull(full.presenca),
    evolucao: orNull(full.evolucao)
  }
}

function assertPatientExists(db: Db, patientId: number): void {
  const row = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(patientId)
  if (!row) throw new Error('Paciente não encontrado')
}

function assertSlotFree(
  db: Db,
  input: Pick<AppointmentInput, 'inicio' | 'fim'>,
  ignoreId: number | null
): void {
  const busy = db
    .prepare(
      `${SELECT}
       WHERE a.inicio < @fim AND a.fim > @inicio AND a.id IS NOT @ignoreId
       ORDER BY a.inicio, a.id`
    )
    .all({ inicio: input.inicio, fim: input.fim, ignoreId }) as AppointmentRow[]
  if (busy.length === 0) return

  const [first, ...others] = busy
  const time = (value: string): string => formatTime(parseIsoLocalDateTime(value))
  const more =
    others.length === 0
      ? ''
      : ` e mais ${others.length} ${others.length === 1 ? 'sessão' : 'sessões'}`
  throw new Error(
    `Esse horário já está ocupado: ${first.patient_nome}, das ${time(first.inicio)} às ${time(first.fim)}${more}.`
  )
}

export function getAppointment(db: Db, id: number): Appointment {
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as AppointmentRow | undefined
  if (!row) throw new Error('Agendamento não encontrado')
  return fromRow(row)
}

export function listPatientAppointments(db: Db, patientId: number): Appointment[] {
  const rows = db
    .prepare(`${SELECT} WHERE a.patient_id = ? ORDER BY a.inicio DESC, a.id DESC`)
    .all(patientId) as AppointmentRow[]
  return rows.map(fromRow)
}

export function listAppointments(db: Db, de: string, ate: string): Appointment[] {
  const rows = db
    .prepare(`${SELECT} WHERE a.inicio < @ate AND a.fim > @de ORDER BY a.inicio, p.nome`)
    .all({ de, ate }) as AppointmentRow[]
  return rows.map(fromRow)
}

export function createAppointment(db: Db, input: AppointmentInput): Appointment {
  assertPatientExists(db, input.patient_id)
  assertSlotFree(db, input, null)
  const result = db
    .prepare(
      `INSERT INTO appointments (patient_id, inicio, fim, observacao, tipo, presenca, evolucao)
       VALUES (@patient_id, @inicio, @fim, @observacao, @tipo, @presenca, @evolucao)`
    )
    .run(toParams(input))
  return getAppointment(db, Number(result.lastInsertRowid))
}

export function updateAppointment(
  db: Db,
  id: number,
  input: AppointmentInput,
  expected?: string
): Appointment {
  assertUnchanged(getAppointment(db, id).updated_at, expected)
  assertPatientExists(db, input.patient_id)
  assertSlotFree(db, input, id)
  const result = db
    .prepare(
      `UPDATE appointments
       SET patient_id = @patient_id, inicio = @inicio, fim = @fim, observacao = @observacao,
           tipo = @tipo, presenca = @presenca, evolucao = @evolucao,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = @id`
    )
    .run({ ...toParams(input), id })
  if (result.changes === 0) throw new Error('Agendamento não encontrado')
  return getAppointment(db, id)
}

export function removeAppointment(db: Db, id: number): void {
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Agendamento não encontrado')
}
