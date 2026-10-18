import {
  ANAMNESE_FIELDS,
  emptyAnamneseInput,
  type Anamnese,
  type AnamneseInput
} from '../../shared/schemas'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

type AnamneseRow = { [K in keyof AnamneseInput]: string | null } & {
  patient_id: number
  updated_at: string
}

function assertPatientExists(db: Db, patientId: number): void {
  const row = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(patientId)
  if (!row) throw new Error('Paciente não encontrado')
}

/** A anamnese do paciente; ainda não escrita, vem com os campos vazios e `updated_at` null. */
export function getAnamnese(db: Db, patientId: number): Anamnese {
  assertPatientExists(db, patientId)
  const row = db.prepare('SELECT * FROM anamneses WHERE patient_id = ?').get(patientId) as
    | AnamneseRow
    | undefined
  if (!row) return { ...emptyAnamneseInput(), patient_id: patientId, updated_at: null }
  const anamnese = { ...emptyAnamneseInput(), patient_id: patientId, updated_at: row.updated_at }
  for (const field of ANAMNESE_FIELDS) anamnese[field] = row[field] ?? ''
  return anamnese
}

/**
 * Grava a anamnese (cria na primeira vez). `expected`: o `updated_at` de quando foi aberta, ou ''
 * se ainda não existia; recusa se outra pessoa salvou depois, como na ficha.
 */
export function saveAnamnese(
  db: Db,
  patientId: number,
  input: AnamneseInput,
  expected?: string
): Anamnese {
  assertUnchanged(getAnamnese(db, patientId).updated_at ?? '', expected)
  const params: Record<string, string | number | null> = { patient_id: patientId }
  for (const field of ANAMNESE_FIELDS) params[field] = input[field] === '' ? null : input[field]
  const columns = ANAMNESE_FIELDS.join(', ')
  const values = ANAMNESE_FIELDS.map((f) => `@${f}`).join(', ')
  const assignments = ANAMNESE_FIELDS.map((f) => `${f} = excluded.${f}`).join(', ')
  db.prepare(
    `INSERT INTO anamneses (patient_id, ${columns}) VALUES (@patient_id, ${values})
     ON CONFLICT (patient_id) DO UPDATE
     SET ${assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  ).run(params)
  return getAnamnese(db, patientId)
}
