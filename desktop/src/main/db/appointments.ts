import { foraDoFuncionamentoIso } from '../../shared/agenda'
import { pedidoNaSessao, type RegistroDoPedido } from '../../shared/confirmacao'
import { toIsoLocalDateTime } from '../../shared/dates'
import {
  appointmentInputSchema,
  type Appointment,
  type AppointmentInput
} from '../../shared/schemas'
import type { EtiquetaResumo } from '../../shared/tipos'
import { getFuncionamento } from './clinic'
import { assertAgendaFree } from './busy'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'
import {
  assertTipoUsavel,
  setAppointmentEtiquetas,
  TIPO_COLUMNS,
  TIPO_JOIN,
  tipoPadrao
} from './tipos'

type AppointmentRow = Omit<
  Appointment,
  'observacao' | 'presenca' | 'evolucao' | 'assinatura' | 'etiquetas' | 'pedido'
> & {
  etiquetas: string
  pedido: string | null
  observacao: string | null
  presenca: Appointment['presenca'] | null
  evolucao: string | null
  assinatura_id: number | null
  assinatura_nome: string | null
  assinatura_parentesco: string | null
  assinatura_em: string | null
}

const SELECT = `
  SELECT a.id, a.patient_id, a.inicio, a.fim, a.observacao, ${TIPO_COLUMNS}, a.presenca,
         a.evolucao, a.confirmado_em, a.created_at, a.updated_at, p.nome AS patient_nome,
         s.id AS assinatura_id, s.signer_nome AS assinatura_nome,
         s.signer_parentesco AS assinatura_parentesco, s.assinado_em AS assinatura_em,
         (SELECT json_group_array(json_object('id', g.id, 'nome', g.nome, 'cor', g.cor))
            FROM (SELECT g.id, g.nome, g.cor FROM appointment_tags x
                  JOIN tags g ON g.id = x.tag_id
                  WHERE x.appointment_id = a.id ORDER BY g.nome COLLATE NOCASE) g) AS etiquetas,
         (SELECT json_object('estado', r.estado, 'resposta', r.resposta, 'prazo', r.prazo)
            FROM confirmation_requests r
            WHERE r.appointment_id = a.id AND r.estado <> 'cancelado'
            ORDER BY r.id DESC LIMIT 1) AS pedido
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  ${TIPO_JOIN}
  LEFT JOIN attendance_signatures s
    ON s.appointment_id = a.id AND s.id NOT IN (SELECT signature_id FROM attendance_voids)`

function fromRow(row: AppointmentRow): Appointment {
  const {
    assinatura_id: id,
    assinatura_nome: nome,
    assinatura_parentesco: parentesco,
    assinatura_em: em,
    ...rest
  } = row
  return {
    ...rest,
    etiquetas: JSON.parse(row.etiquetas) as EtiquetaResumo[],
    pedido: pedidoNaSessao(
      row.pedido === null ? null : (JSON.parse(row.pedido) as RegistroDoPedido),
      row.confirmado_em
    ),
    observacao: row.observacao ?? '',
    presenca: row.presenca ?? '',
    evolucao: row.evolucao ?? '',
    assinatura:
      id === null
        ? null
        : {
            id,
            signer_nome: nome ?? '',
            signer_parentesco: parentesco ?? '',
            assinado_em: em ?? ''
          }
  }
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

const orNull = (value: string): string | null => (value === '' ? null : value)

function toParams(input: AppointmentInput): Record<string, string | number | null> {
  const full = appointmentInputSchema.parse(input)
  return {
    confirmado: full.confirmado === undefined ? null : Number(full.confirmado),
    patient_id: full.patient_id,
    inicio: full.inicio,
    fim: full.fim,
    observacao: orNull(full.observacao),
    tipo_id: full.tipo_id ?? null,
    presenca: orNull(full.presenca),
    evolucao: orNull(full.evolucao)
  }
}

function assertPatientExists(db: Db, patientId: number): void {
  const row = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(patientId)
  if (!row) throw new Error('Paciente não encontrado')
}

export function assertWithinHours(db: Db, input: Pick<AppointmentInput, 'inicio' | 'fim'>): void {
  const problem = foraDoFuncionamentoIso(getFuncionamento(db), input.inicio, input.fim)
  if (problem) throw new Error(problem)
}

function assertSlotFree(
  db: Db,
  input: Pick<AppointmentInput, 'inicio' | 'fim' | 'presenca'>,
  ignoreId: number | null
): void {
  if (input.presenca === 'desmarcou') return
  assertAgendaFree(db, input, { appointment: ignoreId })
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

export const PRESENCA_SO_ASSINADA = 'A presença é marcada pela assinatura da chegada.'

export function createAppointment(
  db: Db,
  input: AppointmentInput,
  agora: Date = new Date()
): Appointment {
  if (input.presenca === 'presente') throw new Error(PRESENCA_SO_ASSINADA)
  return db.transaction(() => {
    assertPatientExists(db, input.patient_id)
    const tipoId = input.tipo_id ?? tipoPadrao(db)
    assertTipoUsavel(db, tipoId)
    assertWithinHours(db, input)
    assertSlotFree(db, input, null)
    const result = db
      .prepare(
        `INSERT INTO appointments
           (patient_id, inicio, fim, observacao, tipo_id, presenca, evolucao, confirmado_em)
         VALUES (@patient_id, @inicio, @fim, @observacao, @tipo_id, @presenca, @evolucao,
           CASE WHEN @confirmado = 1 THEN ${NOW} END)`
      )
      .run({ ...toParams(input), tipo_id: tipoId })
    const id = Number(result.lastInsertRowid)
    if (input.etiquetas) setAppointmentEtiquetas(db, id, input.etiquetas)
    if (input.inicio >= toIsoLocalDateTime(agora)) {
      db.prepare(
        `UPDATE waitlist_entries
         SET encerrado_em = ${NOW}, encerrado_motivo = 'agendado', appointment_id = @id,
             updated_at = ${NOW}
         WHERE patient_id = @patient_id AND encerrado_em IS NULL`
      ).run({ id, patient_id: input.patient_id })
    }
    return getAppointment(db, id)
  })()
}

export function updateAppointment(
  db: Db,
  id: number,
  input: AppointmentInput,
  expected?: string
): Appointment {
  return db.transaction(() => {
    const current = getAppointment(db, id)
    assertUnchanged(current.updated_at, expected)
    if (input.presenca === 'presente' && current.presenca !== 'presente') {
      throw new Error(PRESENCA_SO_ASSINADA)
    }
    assertPatientExists(db, input.patient_id)
    if (input.tipo_id !== undefined && input.tipo_id !== current.tipo_id) {
      assertTipoUsavel(db, input.tipo_id)
    }
    if (input.inicio !== current.inicio || input.fim !== current.fim) assertWithinHours(db, input)
    assertSlotFree(db, input, id)
    const result = db
      .prepare(
        `UPDATE appointments
         SET patient_id = @patient_id, inicio = @inicio, fim = @fim, observacao = @observacao,
             tipo_id = coalesce(@tipo_id, tipo_id), presenca = @presenca, evolucao = @evolucao,
             confirmado_em = CASE
               WHEN @confirmado IS NULL THEN confirmado_em
               WHEN @confirmado = 1 THEN coalesce(confirmado_em, ${NOW})
             END,
             updated_at = ${NOW}
         WHERE id = @id`
      )
      .run({ ...toParams(input), id })
    if (result.changes === 0) throw new Error('Agendamento não encontrado')
    if (input.etiquetas) {
      setAppointmentEtiquetas(
        db,
        id,
        input.etiquetas,
        current.etiquetas.map((e) => e.id)
      )
    }
    return getAppointment(db, id)
  })()
}

export function moveAppointment(
  db: Db,
  id: number,
  slot: { inicio: string; fim: string },
  expected?: string
): Appointment {
  const current = getAppointment(db, id)
  assertUnchanged(current.updated_at, expected)
  if (current.assinatura) {
    throw new Error('A chegada desta sessão foi assinada: o horário não muda mais.')
  }
  assertWithinHours(db, slot)
  assertAgendaFree(db, slot, { appointment: id })
  db.prepare(
    `UPDATE appointments
     SET inicio = @inicio, fim = @fim, presenca = NULL, confirmado_em = NULL, updated_at = ${NOW}
     WHERE id = @id`
  ).run({ ...slot, id })
  return getAppointment(db, id)
}

export function removeAppointment(db: Db, id: number): void {
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Agendamento não encontrado')
}
