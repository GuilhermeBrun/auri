import { createHash } from 'node:crypto'
import { toIsoDate } from '../../shared/dates'
import type {
  Appointment,
  ArrivalSignInput,
  AttendanceRecord,
  AttendanceReport,
  SignerPapel
} from '../../shared/schemas'
import { deBase64url, paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { assinaturaMinima, decodificar } from '../../../../web/contrato/assinatura/traco'
import { getAppointment, listPatientAppointments } from './appointments'
import { getClinic } from './clinic'
import type { Db } from './connection'
import { getPatient } from './patients'

type RecordRow = Omit<AttendanceRecord, 'traco' | 'anulada'> & {
  traco: Buffer
  anulada_motivo: string | null
  anulada_em: string | null
  anulada_computador: string | null
}

const SELECT_RECORDS = `
  SELECT s.id, s.appointment_id, a.inicio, a.fim, a.tipo, s.signer_nome, s.signer_papel,
         s.signer_parentesco, s.traco, s.assinado_em, s.fuso_minutos, s.computador,
         s.registro_sha256, v.motivo AS anulada_motivo, v.anulado_em AS anulada_em,
         v.computador AS anulada_computador
  FROM attendance_signatures s
  JOIN appointments a ON a.id = s.appointment_id
  LEFT JOIN attendance_voids v ON v.signature_id = s.id`

function fromRow(row: RecordRow): AttendanceRecord {
  const { anulada_motivo, anulada_em, anulada_computador, traco, ...rest } = row
  return {
    ...rest,
    traco: paraBase64url(new Uint8Array(traco)),
    anulada:
      anulada_motivo === null
        ? null
        : {
            motivo: anulada_motivo,
            anulado_em: anulada_em ?? '',
            computador: anulada_computador ?? ''
          }
  }
}

function readStroke(base64: string): Uint8Array {
  let bytes: Uint8Array
  try {
    bytes = deBase64url(base64)
    const desenho = decodificar(bytes)
    if (assinaturaMinima(desenho)) throw new Error('mínima')
  } catch {
    throw new Error('Assine no quadro antes de confirmar.')
  }
  return bytes
}

export function canonicalRecord(record: {
  appointment: Pick<Appointment, 'id' | 'patient_id' | 'patient_nome' | 'inicio' | 'fim' | 'tipo'>
  signer: { nome: string; papel: SignerPapel; parentesco: string }
  traco: string
  assinado_em: string
  fuso_minutos: number
  computador: string
}): string {
  const { appointment: a, signer } = record
  return JSON.stringify({
    sessao: { id: a.id, inicio: a.inicio, fim: a.fim, tipo: a.tipo },
    paciente: { id: a.patient_id, nome: a.patient_nome },
    assinou: { nome: signer.nome, papel: signer.papel, parentesco: signer.parentesco },
    traco: record.traco,
    assinado_em: record.assinado_em,
    fuso_minutos: record.fuso_minutos,
    computador: record.computador
  })
}

export function signArrival(
  db: Db,
  appointmentId: number,
  input: Required<ArrivalSignInput>,
  computador: string,
  now: Date = new Date()
): Appointment {
  return db.transaction(() => {
    const appointment = getAppointment(db, appointmentId)
    if (appointment.inicio.slice(0, 10) !== toIsoDate(now))
      throw new Error('A chegada só pode ser assinada no dia da sessão.')
    if (appointment.assinatura) throw new Error('Esta sessão já tem a chegada assinada.')
    const bytes = readStroke(input.traco)
    const assinado_em = now.toISOString()
    const fuso_minutos = -now.getTimezoneOffset()
    const signer = {
      nome: input.signer_nome,
      papel: input.signer_papel,
      parentesco: input.signer_parentesco
    }
    const registro = canonicalRecord({
      appointment,
      signer,
      traco: input.traco,
      assinado_em,
      fuso_minutos,
      computador
    })
    db.prepare(
      `UPDATE appointments SET presenca = 'presente',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND presenca IS NOT 'presente'`
    ).run(appointmentId)
    db.prepare(
      `INSERT INTO attendance_signatures (appointment_id, patient_id, signer_nome, signer_papel,
         signer_parentesco, traco, assinado_em, fuso_minutos, computador, registro_sha256)
       VALUES (@appointment_id, @patient_id, @signer_nome, @signer_papel, @signer_parentesco,
         @traco, @assinado_em, @fuso_minutos, @computador, @registro_sha256)`
    ).run({
      appointment_id: appointmentId,
      patient_id: appointment.patient_id,
      signer_nome: signer.nome,
      signer_papel: signer.papel,
      signer_parentesco: signer.parentesco,
      traco: Buffer.from(bytes),
      assinado_em,
      fuso_minutos,
      computador,
      registro_sha256: createHash('sha256').update(registro).digest('hex')
    })
    return getAppointment(db, appointmentId)
  })()
}

export function voidArrival(
  db: Db,
  signatureId: number,
  motivo: string,
  computador: string
): Appointment {
  const row = db
    .prepare('SELECT appointment_id FROM attendance_signatures WHERE id = ?')
    .get(signatureId) as { appointment_id: number } | undefined
  if (!row) throw new Error('Assinatura não encontrada')
  const voided = db
    .prepare('SELECT 1 FROM attendance_voids WHERE signature_id = ?')
    .get(signatureId)
  if (voided) throw new Error('Esta assinatura já foi anulada.')
  db.prepare(
    'INSERT INTO attendance_voids (signature_id, motivo, computador) VALUES (?, ?, ?)'
  ).run(signatureId, motivo, computador)
  return getAppointment(db, row.appointment_id)
}

export function listPatientAttendance(db: Db, patientId: number): AttendanceRecord[] {
  const rows = db
    .prepare(`${SELECT_RECORDS} WHERE s.patient_id = ? ORDER BY a.inicio DESC, s.id DESC`)
    .all(patientId) as RecordRow[]
  return rows.map(fromRow)
}

export function attendanceReport(
  db: Db,
  patientId: number,
  de: string,
  ate: string
): AttendanceReport {
  const patient = getPatient(db, patientId)
  const records = listPatientAttendance(db, patientId)
  const sessions = listPatientAppointments(db, patientId)
    .filter((a) => a.inicio.slice(0, 10) >= de && a.inicio.slice(0, 10) <= ate)
    .reverse()
    .map((a) => ({ ...a, records: records.filter((r) => r.appointment_id === a.id) }))
  return {
    clinic: getClinic(db),
    patient: { id: patient.id, nome: patient.nome, data_nascimento: patient.data_nascimento },
    de,
    ate,
    sessions
  }
}
