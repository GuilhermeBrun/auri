import { describe, expect, it } from 'vitest'
import { createPatientSearch } from './search'

// Somente dados fictícios.
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

  it('não casa entre o nome do paciente e o da mãe', () => {
    expect(names('teste conceicao')).toEqual([])
  })

  it('sem busca devolve todos, na ordem recebida', () => {
    expect(names('')).toEqual(['Beatriz Teste', 'Carlos Demo', 'João Fictício'])
  })
})
