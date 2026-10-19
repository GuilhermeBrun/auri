import { describe, expect, it } from 'vite-plus/test'
import { isAdult, pessoasDaFicha, responsavelDe } from './responsavel'
import { emptyPatientInput, patientInputSchema, type PatientInput } from './schemas'

const HOJE = new Date(2026, 9, 19, 12)

function ficha(over: Partial<PatientInput>): PatientInput {
  return { ...emptyPatientInput(), nome: 'Helena Fictícia', ...over }
}

describe('maioridade', () => {
  it('conta 18 anos completos pela data de nascimento', () => {
    expect(isAdult('2008-10-19', HOJE)).toBe(true)
    expect(isAdult('2008-10-20', HOJE)).toBe(false)
    expect(isAdult('', HOJE)).toBe(false)
  })
})

describe('responsável pelo paciente', () => {
  it('paciente maior de idade responde por si', () => {
    const r = responsavelDe(
      ficha({ data_nascimento: '1990-03-02', mae_nome: 'Marina', celular: '(66) 99999-0000' }),
      HOJE
    )
    expect(r.pessoa).toMatchObject({ papel: 'paciente', nome: 'Helena Fictícia' })
  })

  it('sem escolha, vale a mãe e depois o pai', () => {
    expect(
      responsavelDe(ficha({ mae_nome: 'Marina', pai_nome: 'Paulo' }), HOJE).pessoa
    ).toMatchObject({
      papel: 'mae',
      nome: 'Marina',
      parentesco: 'Mãe'
    })
    expect(responsavelDe(ficha({ pai_nome: 'Paulo' }), HOJE).pessoa).toMatchObject({
      papel: 'pai'
    })
  })

  it('segue a escolha da ficha', () => {
    const r = responsavelDe(
      ficha({ mae_nome: 'Marina', pai_nome: 'Paulo', pai_cpf: '529.982.247-25', resp_tipo: 'pai' }),
      HOJE
    )
    expect(r.pessoa).toMatchObject({ papel: 'pai', cpf: '529.982.247-25' })
  })

  it('outra pessoa leva o parentesco escolhido ou digitado', () => {
    const avo = responsavelDe(
      ficha({ resp_tipo: 'outro', resp_nome: 'Rosa', resp_parentesco: 'avo_f' }),
      HOJE
    )
    expect(avo.pessoa).toMatchObject({ papel: 'outro', nome: 'Rosa', parentesco: 'Avó' })
    const madrinha = responsavelDe(
      ficha({
        resp_tipo: 'outro',
        resp_nome: 'Lúcia',
        resp_parentesco: 'outro',
        resp_parentesco_outro: 'Madrinha'
      }),
      HOJE
    )
    expect(madrinha.pessoa?.parentesco).toBe('Madrinha')
  })

  it('sem ninguém cadastrado, explica o que falta', () => {
    const r = responsavelDe(ficha({}), HOJE)
    expect(r.pessoa).toBeNull()
    expect(r.motivo).toMatch(/Cadastre/)
  })

  it('lista as pessoas da ficha com o paciente adulto em primeiro', () => {
    const papeis = (over: Partial<PatientInput>): string[] =>
      pessoasDaFicha(ficha({ mae_nome: 'Marina', ...over }), HOJE).map((p) => p.papel)
    expect(papeis({})).toEqual(['mae', 'paciente'])
    expect(papeis({ data_nascimento: '1990-03-02' })).toEqual(['paciente', 'mae'])
  })
})

describe('validação do responsável', () => {
  const issues = (over: Partial<PatientInput>): string[] => {
    const result = patientInputSchema.safeParse(ficha(over))
    return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
  }

  it('exige o nome de quem foi escolhido', () => {
    expect(issues({ resp_tipo: 'mae' })).toEqual(['mae_nome'])
    expect(issues({ resp_tipo: 'pai' })).toEqual(['pai_nome'])
  })

  it('exige nome e parentesco de outra pessoa', () => {
    expect(issues({ resp_tipo: 'outro' })).toEqual(['resp_nome', 'resp_parentesco'])
    expect(issues({ resp_tipo: 'outro', resp_nome: 'Lúcia', resp_parentesco: 'outro' })).toEqual([
      'resp_parentesco_outro'
    ])
    expect(issues({ resp_tipo: 'outro', resp_nome: 'Rosa', resp_parentesco: 'avo_f' })).toEqual([])
  })

  it('valida CPF, celular e e-mail do pai e do responsável', () => {
    expect(
      issues({
        pai_cpf: '123.456.789-00',
        resp_celular: '(66) 123',
        email: 'sem-arroba'
      }).sort()
    ).toEqual(['email', 'pai_cpf', 'resp_celular'])
  })
})
