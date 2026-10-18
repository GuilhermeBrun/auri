import { onlyDigits } from './masks'

/** Minúsculas e sem acentos, para a busca encontrar "joao" em "João". */
export function normalizeText(value: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

type Searchable = { nome: string; mae_nome: string; cpf: string; mae_cpf: string }

/**
 * Busca de pacientes: pelo nome ou pelo nome da mãe (sem acentos e sem diferenciar maiúsculas) ou
 * pelos dígitos do CPF do paciente ou da mãe. O texto de cada paciente é preparado uma vez só, então
 * a lista pode ser filtrada a cada tecla: `createPatientSearch(pacientes)('joao')`. Mantém a ordem.
 */
export function createPatientSearch<T extends Searchable>(patients: T[]): (busca: string) => T[] {
  const index = patients.map((patient) => ({
    patient,
    // a busca vem de um campo de uma linha só: as quebras impedem que ela case entre dois campos
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
