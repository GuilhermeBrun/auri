import { onlyDigits } from './masks'

export function normalizeText(value: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

type Searchable = {
  nome: string
  mae_nome: string
  cpf: string
  rg?: string
  mae_cpf: string
  pai_nome?: string
  pai_cpf?: string
  resp_nome?: string
  resp_cpf?: string
}

export function createPatientSearch<T extends Searchable>(patients: T[]): (busca: string) => T[] {
  const index = patients.map((patient) => ({
    patient,
    text: [patient.nome, patient.mae_nome, patient.pai_nome, patient.resp_nome]
      .map((value) => normalizeText(value ?? ''))
      .join('\n'),
    digits: [patient.cpf, patient.rg, patient.mae_cpf, patient.pai_cpf, patient.resp_cpf]
      .map((value) => onlyDigits(value ?? ''))
      .join('\n')
  }))
  return (busca) => {
    const term = normalizeText(busca.trim())
    if (term === '') return patients
    const digits = onlyDigits(busca)
    return index
      .filter((e) => e.text.includes(term) || (digits !== '' && e.digits.includes(digits)))
      .map((e) => e.patient)
  }
}
