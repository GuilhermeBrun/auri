import {
  commitmentInputSchema,
  type Commitment,
  type CommitmentInput
} from '../../shared/commitments'
import type { Appointment, AppointmentInput } from '../../shared/schemas'
import { assertWithinHours, createAppointment } from './appointments'
import { assertAgendaFree } from './busy'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'
import { assertCompromissoUsavel } from './tipos'

type CommitmentRow = Omit<Commitment, 'titulo' | 'observacao' | 'reserva'> & {
  titulo: string | null
  observacao: string | null
  reserva: number
}

const SELECT = `SELECT c.id, c.etiqueta_id, e.nome AS etiqueta_nome, e.cor,
    e.sistema IS 'reserva' AS reserva, c.titulo, c.inicio, c.fim, c.observacao,
    c.created_at, c.updated_at
  FROM commitments c JOIN appointment_types e ON e.id = c.etiqueta_id`

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

function fromRow(row: CommitmentRow): Commitment {
  return {
    ...row,
    reserva: row.reserva === 1,
    titulo: row.titulo ?? '',
    observacao: row.observacao ?? ''
  }
}

function toParams(input: CommitmentInput): Record<string, string | number | null> & {
  inicio: string
  fim: string
  etiqueta_id: number
} {
  const full = commitmentInputSchema.parse(input)
  return {
    etiqueta_id: full.etiqueta_id,
    titulo: full.titulo === '' ? null : full.titulo,
    inicio: full.inicio,
    fim: full.fim,
    observacao: full.observacao === '' ? null : full.observacao
  }
}

export function getCommitment(db: Db, id: number): Commitment {
  const row = db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as CommitmentRow | undefined
  if (!row) throw new Error('Compromisso não encontrado')
  return fromRow(row)
}

export function listCommitments(db: Db, de: string, ate: string): Commitment[] {
  const rows = db
    .prepare(`${SELECT} WHERE c.inicio < @ate AND c.fim > @de ORDER BY c.inicio, c.id`)
    .all({ de, ate }) as CommitmentRow[]
  return rows.map(fromRow)
}

export function createCommitment(db: Db, input: CommitmentInput): Commitment {
  const params = toParams(input)
  assertCompromissoUsavel(db, params.etiqueta_id)
  const slot = { inicio: params.inicio, fim: params.fim }
  assertWithinHours(db, slot)
  assertAgendaFree(db, slot)
  const result = db
    .prepare(
      `INSERT INTO commitments (etiqueta_id, titulo, inicio, fim, observacao)
       VALUES (@etiqueta_id, @titulo, @inicio, @fim, @observacao)`
    )
    .run(params)
  return getCommitment(db, Number(result.lastInsertRowid))
}

export function updateCommitment(
  db: Db,
  id: number,
  input: CommitmentInput,
  expected?: string
): Commitment {
  const current = getCommitment(db, id)
  assertUnchanged(current.updated_at, expected)
  const params = toParams(input)
  assertCompromissoUsavel(db, params.etiqueta_id)
  const slot = { inicio: params.inicio, fim: params.fim }
  if (slot.inicio !== current.inicio || slot.fim !== current.fim) assertWithinHours(db, slot)
  assertAgendaFree(db, slot, { commitment: id })
  db.prepare(
    `UPDATE commitments
     SET etiqueta_id = @etiqueta_id, titulo = @titulo, inicio = @inicio, fim = @fim, observacao = @observacao,
         updated_at = ${NOW}
     WHERE id = @id`
  ).run({ ...params, id })
  return getCommitment(db, id)
}

export function removeCommitment(db: Db, id: number): void {
  const result = db.prepare('DELETE FROM commitments WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Compromisso não encontrado')
}

export function scheduleOnReserve(
  db: Db,
  reserveId: number,
  input: AppointmentInput,
  agora: Date = new Date()
): Appointment {
  return db.transaction(() => {
    const reserve = getCommitment(db, reserveId)
    if (!reserve.reserva) throw new Error('Só uma reserva pode virar agendamento')
    removeCommitment(db, reserveId)
    return createAppointment(db, input, agora)
  })()
}
