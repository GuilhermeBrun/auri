import {
  PATIENT_FIELDS,
  type Patient,
  type PatientFilter,
  type PatientInput
} from '../../shared/schemas'
import { createPatientSearch } from '../../shared/search'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type PatientRow = { [K in keyof PatientInput]: string | null } & {
  id: number
  ativo: number
  created_at: string
  updated_at: string
}

function fromRow(row: PatientRow): Patient {
  const patient = { ...row, ativo: row.ativo === 1 } as unknown as Patient
  const fields = patient as unknown as Record<keyof PatientInput, string>
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

export function getPatient(db: Db, id: number): Patient {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined
  if (!row) throw new Error('Paciente não encontrado')
  return fromRow(row)
}

export function listPatients(db: Db, filter: Required<PatientFilter>): Patient[] {
  const rows = db
    .prepare(
      `SELECT * FROM patients
       WHERE (@incluirInativos = 1 OR ativo = 1)
       ORDER BY normalize_text(nome)`
    )
    .all({ incluirInativos: filter.incluirInativos ? 1 : 0 }) as PatientRow[]
  return createPatientSearch(rows.map(fromRow))(filter.busca)
}

export function createPatient(db: Db, input: PatientInput): Patient {
  const columns = PATIENT_FIELDS.join(', ')
  const values = PATIENT_FIELDS.map((f) => `@${f}`).join(', ')
  const result = db
    .prepare(`INSERT INTO patients (${columns}) VALUES (${values})`)
    .run(toParams(input))
  return getPatient(db, Number(result.lastInsertRowid))
}

export function updatePatient(db: Db, id: number, input: PatientInput, expected?: string): Patient {
  assertUnchanged(getPatient(db, id).updated_at, expected)
  const assignments = PATIENT_FIELDS.map((f) => `${f} = @${f}`).join(', ')
  const result = db
    .prepare(
      `UPDATE patients SET ${assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = @id`
    )
    .run({ ...toParams(input), id })
  if (result.changes === 0) throw new Error('Paciente não encontrado')
  return getPatient(db, id)
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
