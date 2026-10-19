import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyAnamneseInput, emptyPatientInput } from '../../shared/schemas'
import { saveAnamnese } from './anamneses'
import { createAppointment } from './appointments'
import { openDatabase, type Db } from './connection'
import { anamneseDocument, evolutionReport, patientDocument } from './documents'
import { createPatient } from './patients'

let db: Db
let patientId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Helena Fictícia' }).id
})

const sessao = (inicio: string, evolucao: string): number =>
  createAppointment(db, {
    patient_id: patientId,
    inicio,
    fim: inicio.replace(':00', ':45'),
    observacao: '',
    evolucao
  }).id

describe('documentos do paciente', () => {
  it('evoluções do período, da mais antiga para a mais nova, sem as vazias', () => {
    sessao('2026-09-30T14:00', 'Fora do período')
    const primeira = sessao('2026-10-01T14:00', 'Primeira')
    sessao('2026-10-08T14:00', '')
    const ultima = sessao('2026-10-31T18:00', 'Último dia')
    sessao('2026-11-01T14:00', 'Depois')
    const report = evolutionReport(db, patientId, '2026-10-01', '2026-10-31')
    expect(report.patient).toMatchObject({ id: patientId, nome: 'Helena Fictícia' })
    expect(report.sessions.map((s) => s.id)).toEqual([primeira, ultima])
  })

  it('ficha e anamnese com os dados da clínica', () => {
    saveAnamnese(db, patientId, { ...emptyAnamneseInput(), queixa: 'Troca de sons' })
    expect(patientDocument(db, patientId).patient.nome).toBe('Helena Fictícia')
    const doc = anamneseDocument(db, patientId)
    expect(doc.anamnese.queixa).toBe('Troca de sons')
    expect(doc.clinic.nome).toBe('')
  })

  it('paciente inexistente', () => {
    expect(() => patientDocument(db, 999)).toThrow()
    expect(() => evolutionReport(db, 999, '2026-10-01', '2026-10-31')).toThrow()
  })
})
