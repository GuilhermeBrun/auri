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

type CommitmentRow = Omit<Commitment, 'titulo' | 'observacao'> & {
  titulo: string | null
  observacao: string | null
}

const SELECT = `SELECT id, tipo, titulo, inicio, fim, observacao, created_at, updated_at
  FROM commitments`

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

function fromRow(row: CommitmentRow): Commitment {
  return { ...row, titulo: row.titulo ?? '', observacao: row.observacao ?? '' }
}

function toParams(input: CommitmentInput): Record<string, string | null> {
  const full = commitmentInputSchema.parse(input)
  return {
    tipo: full.tipo,
    titulo: full.titulo === '' ? null : full.titulo,
    inicio: full.inicio,
    fim: full.fim,
    observacao: full.observacao === '' ? null : full.observacao
  }
}

export function getCommitment(db: Db, id: number): Commitment {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as CommitmentRow | undefined
  if (!row) throw new Error('Compromisso não encontrado')
  return fromRow(row)
}

export function listCommitments(db: Db, de: string, ate: string): Commitment[] {
  const rows = db
    .prepare(`${SELECT} WHERE inicio < @ate AND fim > @de ORDER BY inicio, id`)
    .all({ de, ate }) as CommitmentRow[]
  return rows.map(fromRow)
}

export function createCommitment(db: Db, input: CommitmentInput): Commitment {
  const params = toParams(input)
  const slot = { inicio: params.inicio!, fim: params.fim! }
  assertWithinHours(db, slot)
  assertAgendaFree(db, slot)
  const result = db
    .prepare(
      `INSERT INTO commitments (tipo, titulo, inicio, fim, observacao)
       VALUES (@tipo, @titulo, @inicio, @fim, @observacao)`
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
  const slot = { inicio: params.inicio!, fim: params.fim! }
  if (slot.inicio !== current.inicio || slot.fim !== current.fim) assertWithinHours(db, slot)
  assertAgendaFree(db, slot, { commitment: id })
  db.prepare(
    `UPDATE commitments
     SET tipo = @tipo, titulo = @titulo, inicio = @inicio, fim = @fim, observacao = @observacao,
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
    if (reserve.tipo !== 'reserva') throw new Error('Só uma reserva pode virar agendamento')
    removeCommitment(db, reserveId)
    return createAppointment(db, input, agora)
  })()
}
