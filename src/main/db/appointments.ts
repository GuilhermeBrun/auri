import { formatTime, parseIsoLocalDateTime } from '../../shared/dates'
import type { Appointment, AppointmentInput } from '../../shared/schemas'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type AppointmentRow = Omit<Appointment, 'observacao'> & { observacao: string | null }

const SELECT = `
  SELECT a.id, a.patient_id, a.inicio, a.fim, a.observacao, a.created_at, a.updated_at,
         p.nome AS patient_nome
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id`

function fromRow(row: AppointmentRow): Appointment {
  return { ...row, observacao: row.observacao ?? '' }
}

function toParams(input: AppointmentInput): Record<string, string | number | null> {
  return {
    patient_id: input.patient_id,
    inicio: input.inicio,
    fim: input.fim,
    observacao: input.observacao === '' ? null : input.observacao
  }
}

function assertPatientExists(db: Db, patientId: number): void {
  const row = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(patientId)
  if (!row) throw new Error('Paciente não encontrado')
}

/**
 * Só há um profissional, então dois pacientes não podem ocupar o mesmo horário. Sessões encostadas
 * (uma termina às 14:30, a outra começa às 14:30) não se sobrepõem. `ignoreId` é a própria sessão
 * ao editar. Fica aqui, e não só no formulário, para valer para qualquer chamada da API; o driver é
 * síncrono, então nada entra entre esta checagem e a gravação.
 */
function assertSlotFree(db: Db, input: AppointmentInput, ignoreId: number | null): void {
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

/** Agendamentos que se sobrepõem a [de, ate). Datas locais em texto ISO comparam em ordem. */
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
      `INSERT INTO appointments (patient_id, inicio, fim, observacao)
       VALUES (@patient_id, @inicio, @fim, @observacao)`
    )
    .run(toParams(input))
  return getAppointment(db, Number(result.lastInsertRowid))
}

/** `expected`: ver `updatePatient`. */
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
