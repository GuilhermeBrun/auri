import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput, patientInputSchema, type PatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from './connection'
import { SCHEMA_VERSION } from './migrations'
import { createPatient, getPatient, listPatients, setPatientAtivo, updatePatient } from './patients'

function patient(overrides: Partial<PatientInput>): PatientInput {
  return { ...emptyPatientInput(), ...overrides }
}

const ALL = { busca: '', incluirInativos: false }

let db: Db

beforeEach(() => {
  db = openDatabase(':memory:')
})

describe('migrations', () => {
  it('deixa o banco na versão atual', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })
})

describe('pacientes', () => {
  it('cria e lê, devolvendo campos vazios como string vazia', () => {
    const created = createPatient(
      db,
      patient({ nome: 'João Teste', data_nascimento: '2019-08-17', mae_nome: 'Maria Teste' })
    )
    expect(created.id).toBeGreaterThan(0)
    expect(created.ativo).toBe(true)
    expect(created.cpf).toBe('')

    const row = db.prepare('SELECT cpf FROM patients WHERE id = ?').get(created.id) as {
      cpf: string | null
    }
    expect(row.cpf).toBeNull()
    expect(getPatient(db, created.id)).toEqual(created)
  })

  it('atualiza os dados', () => {
    const created = createPatient(db, patient({ nome: 'Ana Exemplo' }))
    const updated = updatePatient(
      db,
      created.id,
      patient({ nome: 'Ana Exemplo', escola: 'Escola X' })
    )
    expect(updated.escola).toBe('Escola X')
    expect(() => updatePatient(db, 9999, patient({ nome: 'X' }))).toThrow('Paciente não encontrado')
  })

  it('busca por nome sem acento e sem diferenciar maiúsculas, pelo nome da mãe e por CPF', () => {
    createPatient(db, patient({ nome: 'João Fictício', cpf: '529.982.247-25' }))
    createPatient(db, patient({ nome: 'Beatriz Teste', mae_nome: 'Conceição Exemplo' }))
    createPatient(db, patient({ nome: 'Carlos Demo', mae_cpf: '111.444.777-35' }))

    const names = (busca: string): string[] =>
      listPatients(db, { busca, incluirInativos: false }).map((p) => p.nome)

    expect(names('joao')).toEqual(['João Fictício'])
    expect(names('FICTICIO')).toEqual(['João Fictício'])
    expect(names('conceicao')).toEqual(['Beatriz Teste'])
    expect(names('52998224725')).toEqual(['João Fictício'])
    expect(names('444.777')).toEqual(['Carlos Demo'])
    expect(names('')).toEqual(['Beatriz Teste', 'Carlos Demo', 'João Fictício'])
  })

  it('esconde inativos por padrão e permite reativar', () => {
    const p = createPatient(db, patient({ nome: 'Paciente Inativo' }))
    expect(setPatientAtivo(db, p.id, false).ativo).toBe(false)
    expect(listPatients(db, ALL)).toHaveLength(0)
    expect(listPatients(db, { busca: '', incluirInativos: true })).toHaveLength(1)
    expect(setPatientAtivo(db, p.id, true).ativo).toBe(true)
    expect(listPatients(db, ALL)).toHaveLength(1)
  })
})

describe('validação do cadastro', () => {
  it('exige nome e valida CPF, celular, e-mail e datas', () => {
    const result = patientInputSchema.safeParse(
      patient({
        nome: '  ',
        cpf: '123.456.789-00',
        mae_celular: '(66) 123',
        mae_email: 'sem-arroba',
        data_nascimento: '2025-02-30'
      })
    )
    expect(result.success).toBe(false)
    const fields = result.error!.issues.map((i) => i.path[0])
    expect(fields).toEqual(
      expect.arrayContaining(['nome', 'cpf', 'mae_celular', 'mae_email', 'data_nascimento'])
    )
  })

  it('aceita campos opcionais vazios e remove espaços', () => {
    const result = patientInputSchema.parse(patient({ nome: '  Ana  ' }))
    expect(result.nome).toBe('Ana')
  })
})
