import { DIAS_SEMANA, type DiaSemana, type Funcionamento } from '../../shared/agenda'
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
  margem_deslocamento: number
  updated_at: string
}

type HoursRow = { dia_semana: DiaSemana; abre: string; fecha: string }

export function getFuncionamento(db: Db): Funcionamento {
  const rows = db
    .prepare('SELECT dia_semana, abre, fecha FROM clinic_hours ORDER BY dia_semana')
    .all() as HoursRow[]
  const funcionamento: Funcionamento = {}
  for (const { dia_semana, abre, fecha } of rows) funcionamento[dia_semana] = { abre, fecha }
  return funcionamento
}

function saveFuncionamento(db: Db, funcionamento: Funcionamento): void {
  db.prepare('DELETE FROM clinic_hours').run()
  const insert = db.prepare('INSERT INTO clinic_hours (dia_semana, abre, fecha) VALUES (?, ?, ?)')
  for (const dia of DIAS_SEMANA) {
    const horario = funcionamento[dia]
    if (horario) insert.run(dia, horario.abre, horario.fecha)
  }
}

export function getClinic(db: Db): Clinic {
  const row = db.prepare('SELECT * FROM clinic WHERE id = 1').get() as ClinicRow
  const clinic = {
    updated_at: row.updated_at,
    logo: row.logo ? row.logo.toString('base64') : '',
    funcionamento: getFuncionamento(db),
    margem_deslocamento: row.margem_deslocamento
  }
  for (const field of FIELDS) Object.assign(clinic, { [field]: row[field] ?? '' })
  return clinic as Clinic
}

export function saveClinic(db: Db, input: ClinicFields, expected?: string): Clinic {
  return db.transaction(() => {
    assertUnchanged(getClinic(db).updated_at, expected)
    if (input.funcionamento) saveFuncionamento(db, input.funcionamento)
    if (input.margem_deslocamento !== undefined) {
      db.prepare('UPDATE clinic SET margem_deslocamento = ? WHERE id = 1').run(
        input.margem_deslocamento
      )
    }
    return saveFields(db, input)
  })()
}

type ClinicFields = Omit<Required<ClinicInput>, 'funcionamento' | 'margem_deslocamento'> & {
  funcionamento?: Funcionamento
  margem_deslocamento?: number
}

function saveFields(db: Db, input: ClinicFields): Clinic {
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
