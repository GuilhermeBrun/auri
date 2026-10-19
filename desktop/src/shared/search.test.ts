import { describe, expect, it } from 'vite-plus/test'
import { createPatientSearch } from './search'

const patients = [
  { nome: 'Beatriz Teste', mae_nome: 'Conceição Exemplo', cpf: '', mae_cpf: '' },
  { nome: 'Carlos Demo', mae_nome: '', cpf: '', mae_cpf: '111.444.777-35' },
  { nome: 'João Fictício', mae_nome: '', cpf: '529.982.247-25', mae_cpf: '' }
]

const names = (busca: string): string[] => createPatientSearch(patients)(busca).map((p) => p.nome)

describe('busca de pacientes', () => {
  it('encontra pelo nome sem acento e sem diferenciar maiúsculas', () => {
    expect(names('joao')).toEqual(['João Fictício'])
    expect(names('  FICTICIO ')).toEqual(['João Fictício'])
  })

  it('encontra pelo nome da mãe e pelos dígitos do CPF', () => {
    expect(names('conceicao')).toEqual(['Beatriz Teste'])
    expect(names('52998224725')).toEqual(['João Fictício'])
    expect(names('444.777')).toEqual(['Carlos Demo'])
  })

  it('encontra pelo pai e pelo responsável', () => {
    const search = createPatientSearch([
      ...patients,
      {
        nome: 'Davi Exemplo',
        mae_nome: '',
        cpf: '',
        mae_cpf: '',
        pai_nome: 'Otávio Pai',
        pai_cpf: '',
        resp_nome: 'Rosa Avó',
        resp_cpf: '168.995.350-09'
      }
    ])
    const found = (busca: string): string[] => search(busca).map((p) => p.nome)
    expect(found('otavio')).toEqual(['Davi Exemplo'])
    expect(found('rosa avo')).toEqual(['Davi Exemplo'])
    expect(found('16899535009')).toEqual(['Davi Exemplo'])
  })

  it('não casa entre o nome do paciente e o da mãe', () => {
    expect(names('teste conceicao')).toEqual([])
  })

  it('sem busca devolve todos, na ordem recebida', () => {
    expect(names('')).toEqual(['Beatriz Teste', 'Carlos Demo', 'João Fictício'])
  })
})
