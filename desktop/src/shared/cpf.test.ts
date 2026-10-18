import { describe, expect, it } from 'vite-plus/test'
import { isValidCpf } from './cpf'
import { formatCpf, formatPhone, isValidPhone } from './masks'

describe('isValidCpf', () => {
  it('aceita CPFs válidos, com ou sem pontuação', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.444.777-53')).toBe(false)
  })

  it('rejeita tamanho errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247')).toBe(false)
    expect(isValidCpf('')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('000.000.000-00')).toBe(false)
  })
})

describe('máscaras', () => {
  it('formata CPF enquanto digita', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('529982247259999')).toBe('529.982.247-25')
  })

  it('formata celular e telefone fixo', () => {
    expect(formatPhone('66')).toBe('(66')
    expect(formatPhone('669')).toBe('(66) 9')
    expect(formatPhone('6635323669')).toBe('(66) 3532-3669')
    expect(formatPhone('66912345678')).toBe('(66) 91234-5678')
  })

  it('valida telefone por quantidade de dígitos', () => {
    expect(isValidPhone('(66) 91234-5678')).toBe(true)
    expect(isValidPhone('(66) 3532-3669')).toBe(true)
    expect(isValidPhone('(66) 9123')).toBe(false)
  })
})
