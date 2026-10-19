import { describe, expect, it } from 'vite-plus/test'
import { CENTAVOS_MAX, centavosToInput, formatBRL, maskBRL, parseBRL } from './money'

describe('formatBRL', () => {
  it('formata centavos em reais com milhar e vírgula', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatBRL(5)).toBe('R$ 0,05')
    expect(formatBRL(19000)).toBe('R$ 190,00')
    expect(formatBRL(152000)).toBe('R$ 1.520,00')
    expect(formatBRL(123456789)).toBe('R$ 1.234.567,89')
  })

  it('negativo com o sinal de menos tipográfico', () => {
    expect(formatBRL(-3800)).toBe('−R$ 38,00')
  })

  it('usa espaço comum, igual em qualquer sistema', () => {
    expect(formatBRL(100)).not.toMatch(/ /)
  })
})

describe('parseBRL', () => {
  it('lê o que a pessoa digita', () => {
    expect(parseBRL('190')).toBe(19000)
    expect(parseBRL('190,5')).toBe(19050)
    expect(parseBRL('1.520,00')).toBe(152000)
    expect(parseBRL('R$ 1.520,00')).toBe(152000)
    expect(parseBRL('1520')).toBe(152000)
    expect(parseBRL('0,99')).toBe(99)
  })

  it('recusa o que não é valor', () => {
    expect(parseBRL('')).toBeNull()
    expect(parseBRL('abc')).toBeNull()
    expect(parseBRL('1,999')).toBeNull()
    expect(parseBRL('12.34')).toBeNull()
    expect(parseBRL('-10')).toBeNull()
    expect(parseBRL(String(CENTAVOS_MAX))).toBeNull()
  })

  it('volta ao mesmo valor depois de formatar', () => {
    for (const v of [1, 99, 19000, 152000, 123456789]) expect(parseBRL(formatBRL(v))).toBe(v)
  })
})

describe('maskBRL', () => {
  it('preenche da direita, como caixa registradora', () => {
    expect(maskBRL('1')).toBe('0,01')
    expect(maskBRL('19000')).toBe('190,00')
    expect(maskBRL('152000')).toBe('1.520,00')
    expect(maskBRL('R$ 00190,00x')).toBe('190,00')
    expect(maskBRL('')).toBe('')
  })

  it('valor inicial do campo', () => {
    expect(centavosToInput(0)).toBe('')
    expect(centavosToInput(152000)).toBe('1.520,00')
    expect(parseBRL(maskBRL(centavosToInput(152000)))).toBe(152000)
  })
})
