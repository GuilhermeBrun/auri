import { onlyDigits } from './masks'

export function normalizeText(value: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

type Searchable = { nome: string; mae_nome: string; cpf: string; mae_cpf: string }

export function createPatientSearch<T extends Searchable>(patients: T[]): (busca: string) => T[] {
  const index = patients.map((patient) => ({
    patient,
    text: `${normalizeText(patient.nome)}\n${normalizeText(patient.mae_nome)}`,
    digits: `${onlyDigits(patient.cpf)}\n${onlyDigits(patient.mae_cpf)}`
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
