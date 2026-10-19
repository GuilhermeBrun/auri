import type { Clinic, ClinicInput } from '../../shared/schemas'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'

const FIELDS = [
  'nome',
  'documento',
  'endereco',
  'telefone',
  'whatsapp',
  'profissional',
  'registro'
] as const

type ClinicRow = { [K in (typeof FIELDS)[number]]: string | null } & {
  logo: Buffer | null
  updated_at: string
}

export function getClinic(db: Db): Clinic {
  const row = db.prepare('SELECT * FROM clinic WHERE id = 1').get() as ClinicRow
  const clinic = { updated_at: row.updated_at, logo: row.logo ? row.logo.toString('base64') : '' }
  for (const field of FIELDS) Object.assign(clinic, { [field]: row[field] ?? '' })
  return clinic as Clinic
}

export function saveClinic(db: Db, input: Required<ClinicInput>, expected?: string): Clinic {
  assertUnchanged(getClinic(db).updated_at, expected)
  const params: Record<string, string | Buffer | null> = {
    logo: input.logo === '' ? null : Buffer.from(input.logo, 'base64')
  }
  for (const field of FIELDS) params[field] = input[field] === '' ? null : input[field]
  db.prepare(
    `UPDATE clinic SET ${FIELDS.map((f) => `${f} = @${f}`).join(', ')}, logo = @logo,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = 1`
  ).run(params)
  return getClinic(db)
}
