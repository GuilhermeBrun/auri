import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { anamneseInputSchema, emptyAnamneseInput, emptyPatientInput } from '../../shared/schemas'
import { runOperation } from '../operations'
import { getAnamnese, saveAnamnese } from './anamneses'
import { openDatabase, type Db } from './connection'
import { createPatient } from './patients'

let db: Db
let patientId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' }).id
})

describe('anamnese', () => {
  it('ainda não escrita vem vazia e sem updated_at', () => {
    expect(getAnamnese(db, patientId)).toEqual({
      ...emptyAnamneseInput(),
      patient_id: patientId,
      updated_at: null
    })
    expect(() => getAnamnese(db, 9999)).toThrow('Paciente não encontrado')
  })

  it('cria na primeira gravação e atualiza nas seguintes', () => {
    const first = saveAnamnese(
      db,
      patientId,
      { ...emptyAnamneseInput(), data: '2025-09-05', gestacao: '39 semanas, 3 kg, 46 cm' },
      ''
    )
    expect(first.gestacao).toBe('39 semanas, 3 kg, 46 cm')
    expect(first.sono).toBe('')
    expect(first.updated_at).not.toBeNull()

    const second = saveAnamnese(
      db,
      patientId,
      { ...emptyAnamneseInput(), data: '2025-09-05', sono: 'Acorda às 2h' },
      first.updated_at!
    )
    expect(second.gestacao).toBe('')
    expect(second.sono).toBe('Acorda às 2h')
    expect(db.prepare('SELECT COUNT(*) AS n FROM anamneses').get()).toEqual({ n: 1 })
  })

  it('recusa gravar por cima de quem salvou depois de aberta', () => {
    // dois computadores abriram a anamnese ainda vazia; o primeiro salva
    saveAnamnese(db, patientId, { ...emptyAnamneseInput(), queixa: 'Primeiro' }, '')
    expect(() =>
      saveAnamnese(db, patientId, { ...emptyAnamneseInput(), queixa: 'Segundo' }, '')
    ).toThrow('alterado em outro computador')
    expect(getAnamnese(db, patientId).queixa).toBe('Primeiro')
  })

  it('valida a entrada e avisa as telas pela operação', () => {
    expect(
      anamneseInputSchema.safeParse({ ...emptyAnamneseInput(), data: '31/02/2025' }).success
    ).toBe(false)
    const topics: string[][] = []
    const result = runOperation(
      db,
      'anamneses:save',
      [patientId, { ...emptyAnamneseInput(), queixa: 'Fala pouco' }, ''],
      (t) => topics.push(t)
    )
    expect(result.ok).toBe(true)
    expect(topics).toEqual([['anamneses']])
    expect(runOperation(db, 'anamneses:get', [patientId])).toMatchObject({
      ok: true,
      data: { queixa: 'Fala pouco' }
    })
  })
})
