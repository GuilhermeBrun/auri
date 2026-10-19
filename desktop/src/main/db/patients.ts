import {
  PATIENT_FIELDS,
  type Patient,
  type PatientActivity,
  type PatientActivityInput,
  type PatientField,
  type PatientFilter,
  type PatientInput
} from '../../shared/schemas'
import { createPatientSearch } from '../../shared/search'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type PatientRow = { [K in PatientField]: string | null } & {
  id: number
  ativo: number
  created_at: string
  updated_at: string
}

function fromRow(row: PatientRow, atividades: PatientActivity[]): Patient {
  const patient = { ...row, ativo: row.ativo === 1, atividades } as unknown as Patient
  const fields = patient as unknown as Record<PatientField, string>
  for (const field of PATIENT_FIELDS) {
    fields[field] = row[field] ?? ''
  }
  return patient
}

function toParams(input: PatientInput): Record<string, string | null> {
  const params: Record<string, string | null> = {}
  for (const field of PATIENT_FIELDS) {
    params[field] = input[field] === '' ? null : input[field]
  }
  return params
}

const ACTIVITY_COLUMNS = 'id, patient_id, atividade, dia_semana, inicio, fim'
const ACTIVITY_ORDER = 'ORDER BY dia_semana, inicio, id'

export function listPatientActivities(db: Db, patientId: number): PatientActivity[] {
  return db
    .prepare(
      `SELECT ${ACTIVITY_COLUMNS} FROM patient_activities WHERE patient_id = ? ${ACTIVITY_ORDER}`
    )
    .all(patientId) as PatientActivity[]
}

function replaceActivities(db: Db, patientId: number, atividades: PatientActivityInput[]): void {
  db.prepare('DELETE FROM patient_activities WHERE patient_id = ?').run(patientId)
  const insert = db.prepare(
    `INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim)
     VALUES (@patient_id, @atividade, @dia_semana, @inicio, @fim)`
  )
  for (const a of atividades) insert.run({ ...a, patient_id: patientId })
}

export function getPatient(db: Db, id: number): Patient {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined
  if (!row) throw new Error('Paciente não encontrado')
  return fromRow(row, listPatientActivities(db, id))
}

export function listPatients(db: Db, filter: Required<PatientFilter>): Patient[] {
  const rows = db
    .prepare(
      `SELECT * FROM patients
       WHERE (@incluirInativos = 1 OR ativo = 1)
       ORDER BY normalize_text(nome)`
    )
    .all({ incluirInativos: filter.incluirInativos ? 1 : 0 }) as PatientRow[]
  const byPatient = Map.groupBy(
    db
      .prepare(`SELECT ${ACTIVITY_COLUMNS} FROM patient_activities ${ACTIVITY_ORDER}`)
      .all() as PatientActivity[],
    (a) => a.patient_id
  )
  const patients = rows.map((row) => fromRow(row, byPatient.get(row.id) ?? []))
  return createPatientSearch(patients)(filter.busca)
}

export function createPatient(db: Db, input: PatientInput): Patient {
  const columns = PATIENT_FIELDS.join(', ')
  const values = PATIENT_FIELDS.map((f) => `@${f}`).join(', ')
  return db.transaction(() => {
    const result = db
      .prepare(`INSERT INTO patients (${columns}) VALUES (${values})`)
      .run(toParams(input))
    const id = Number(result.lastInsertRowid)
    replaceActivities(db, id, input.atividades ?? [])
    return getPatient(db, id)
  })()
}

export function updatePatient(db: Db, id: number, input: PatientInput, expected?: string): Patient {
  const assignments = PATIENT_FIELDS.map((f) => `${f} = @${f}`).join(', ')
  return db.transaction(() => {
    assertUnchanged(getPatient(db, id).updated_at, expected)
    const result = db
      .prepare(
        `UPDATE patients SET ${assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = @id`
      )
      .run({ ...toParams(input), id })
    if (result.changes === 0) throw new Error('Paciente não encontrado')
    if (input.atividades) replaceActivities(db, id, input.atividades)
    return getPatient(db, id)
  })()
}

export function setPatientAtivo(db: Db, id: number, ativo: boolean): Patient {
  const result = db
    .prepare(
      `UPDATE patients SET ativo = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
    .run(ativo ? 1 : 0, id)
  if (result.changes === 0) throw new Error('Paciente não encontrado')
  return getPatient(db, id)
}
