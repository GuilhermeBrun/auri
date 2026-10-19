import type { AnamneseDocument, EvolutionReport, PatientDocument } from '../../shared/schemas'
import { getAnamnese } from './anamneses'
import { listPatientAppointments } from './appointments'
import { getClinic } from './clinic'
import type { Db } from './connection'
import { getPatient } from './patients'

export function evolutionReport(
  db: Db,
  patientId: number,
  de: string,
  ate: string
): EvolutionReport {
  const patient = getPatient(db, patientId)
  const sessions = listPatientAppointments(db, patientId)
    .filter((a) => a.evolucao !== '')
    .filter((a) => a.inicio.slice(0, 10) >= de && a.inicio.slice(0, 10) <= ate)
    .reverse()
  return {
    clinic: getClinic(db),
    patient: { id: patient.id, nome: patient.nome, data_nascimento: patient.data_nascimento },
    de,
    ate,
    sessions
  }
}

export function patientDocument(db: Db, patientId: number): PatientDocument {
  return { clinic: getClinic(db), patient: getPatient(db, patientId) }
}

export function anamneseDocument(db: Db, patientId: number): AnamneseDocument {
  return { ...patientDocument(db, patientId), anamnese: getAnamnese(db, patientId) }
}
