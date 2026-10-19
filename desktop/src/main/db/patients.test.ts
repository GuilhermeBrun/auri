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

describe('ficha ampliada', () => {
  it('guarda RG, UF, série estruturada e contato principal', () => {
    const created = createPatient(
      db,
      patient({
        nome: 'Ana Exemplo',
        rg: '12.345.678-9',
        uf: 'MT',
        serie_numero: '3',
        serie_tipo: 'ano',
        serie_etapa: 'fundamental',
        contato_principal: 'pai'
      })
    )
    expect(getPatient(db, created.id)).toMatchObject({
      rg: '12.345.678-9',
      uf: 'MT',
      serie_numero: '3',
      serie_tipo: 'ano',
      serie_etapa: 'fundamental',
      contato_principal: 'pai'
    })
    expect(listPatients(db, { busca: '345678', incluirInativos: false }).map((p) => p.id)).toEqual([
      created.id
    ])
  })
})

describe('atividades extracurriculares', () => {
  const natacao = { atividade: 'Natação', dia_semana: 2, inicio: '14:00', fim: '15:00' }
  const bale = { atividade: 'Balé', dia_semana: 4, inicio: '08:30', fim: '09:30' }

  it('salva junto com a ficha e devolve ordenadas por dia e horário', () => {
    const created = createPatient(db, patient({ nome: 'Ana', atividades: [bale, natacao] }))
    expect(created.atividades.map((a) => a.atividade)).toEqual(['Natação', 'Balé'])
    expect(created.atividades[0]).toEqual({
      id: expect.any(Number),
      patient_id: created.id,
      ...natacao
    })
    expect(listPatients(db, ALL)[0].atividades).toEqual(created.atividades)
  })

  it('a atualização troca a lista inteira, e sem a lista não mexe nas atividades', () => {
    const created = createPatient(db, patient({ nome: 'Ana', atividades: [natacao] }))
    const updated = updatePatient(
      db,
      created.id,
      patient({ nome: 'Ana', atividades: [bale] }),
      created.updated_at
    )
    expect(updated.atividades.map((a) => a.atividade)).toEqual(['Balé'])
    const { atividades: _, ...semLista } = patient({ nome: 'Ana Maria' })
    const kept = updatePatient(db, created.id, semLista, updated.updated_at)
    expect(kept.nome).toBe('Ana Maria')
    expect(kept.atividades.map((a) => a.atividade)).toEqual(['Balé'])
    expect(updatePatient(db, created.id, patient({ nome: 'Ana' })).atividades).toEqual([])
  })

  it('não grava nada quando a ficha mudou em outro computador', () => {
    const created = createPatient(db, patient({ nome: 'Ana', atividades: [natacao] }))
    db.prepare("UPDATE patients SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() =>
      updatePatient(
        db,
        created.id,
        patient({ nome: 'Outra', atividades: [bale] }),
        created.updated_at
      )
    ).toThrow('alterado em outro computador')
    const current = getPatient(db, created.id)
    expect(current.nome).toBe('Ana')
    expect(current.atividades.map((a) => a.atividade)).toEqual(['Natação'])
  })

  it('desfaz o paciente se uma atividade não puder ser gravada', () => {
    expect(() =>
      createPatient(db, patient({ nome: 'Ana', atividades: [{ ...natacao, dia_semana: 9 }] }))
    ).toThrow(/CHECK/)
    expect(listPatients(db, ALL)).toEqual([])
  })

  it('valida atividade, dia e horário, com fim depois do início', () => {
    const issues = (atividades: unknown[]): string[] => {
      const r = patientInputSchema.safeParse({ ...patient({ nome: 'Ana' }), atividades })
      return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    }
    expect(issues([natacao, bale])).toEqual([])
    expect(issues([{ ...natacao, fim: '14:00' }])).toEqual([
      'atividades.0.fim: O término deve ser depois do início'
    ])
    expect(issues([{ ...natacao, atividade: '  ' }])).toEqual([
      'atividades.0.atividade: Diga qual é a atividade'
    ])
    expect(issues([{ ...natacao, inicio: '25:00' }])).toContain(
      'atividades.0.inicio: Horário inválido'
    )
    expect(issues([{ ...natacao, dia_semana: 7 }])).toHaveLength(1)
    expect(issues(Array.from({ length: 21 }, () => natacao))).toHaveLength(1)
  })

  it('pede o tipo quando há número de série e o número quando há tipo', () => {
    const issues = (over: Partial<PatientInput>): string[] => {
      const r = patientInputSchema.safeParse(patient({ nome: 'Ana', ...over }))
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
    }
    expect(issues({ serie_numero: '3', serie_tipo: 'ano' })).toEqual([])
    expect(issues({ serie_numero: '3' })).toEqual(['serie_tipo'])
    expect(issues({ serie_tipo: 'serie' })).toEqual(['serie_numero'])
    expect(issues({ serie_numero: '0', serie_tipo: 'ano' })).toEqual(['serie_numero'])
    expect(issues({ uf: 'XX' as PatientInput['uf'] })).toEqual(['uf'])
  })
})
