import { describe, expect, it } from 'vitest'
import {
  formatAge,
  formatTime,
  isIsoDate,
  isIsoLocalDateTime,
  parseIsoDate,
  parseIsoLocalDateTime
} from './dates'

const today = new Date(2025, 8, 7) // 07/09/2025

describe('formatAge', () => {
  it('mostra dias no primeiro mês', () => {
    expect(formatAge('2025-09-07', today)).toBe('0 dias')
    expect(formatAge('2025-09-06', today)).toBe('1 dia')
    expect(formatAge('2025-08-08', today)).toBe('30 dias')
  })

  it('mostra meses no primeiro ano', () => {
    expect(formatAge('2025-08-07', today)).toBe('1 mês')
    expect(formatAge('2025-05-15', today)).toBe('3 meses')
    expect(formatAge('2024-09-08', today)).toBe('11 meses')
  })

  it('mostra anos a partir de 1 ano', () => {
    expect(formatAge('2024-09-07', today)).toBe('1 ano')
    expect(formatAge('2019-08-17', today)).toBe('6 anos')
    expect(formatAge('2014-09-08', today)).toBe('10 anos')
  })

  it('retorna vazio para data inválida ou futura', () => {
    expect(formatAge('', today)).toBe('')
    expect(formatAge('2025-02-30', today)).toBe('')
    expect(formatAge('2025-09-08', today)).toBe('')
  })
})

describe('validação de datas', () => {
  it('valida datas AAAA-MM-DD', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2025-02-29')).toBe(false)
    expect(isIsoDate('07/09/2025')).toBe(false)
  })

  it('valida data e hora locais', () => {
    expect(isIsoLocalDateTime('2025-09-08T14:30')).toBe(true)
    expect(isIsoLocalDateTime('2025-09-08T24:30')).toBe(false)
    expect(isIsoLocalDateTime('2025-09-08T14:60')).toBe(false)
    expect(isIsoLocalDateTime('2025-02-29T10:00')).toBe(false)
    expect(isIsoLocalDateTime('2025-13-01T10:00')).toBe(false)
    expect(isIsoLocalDateTime('2025-09-08 14:30')).toBe(false)
  })
})

describe('leitura e escrita de datas', () => {
  it('lê data e data/hora como horário local', () => {
    expect(parseIsoDate('2024-02-29')).toEqual(new Date(2024, 1, 29))
    expect(parseIsoLocalDateTime('2025-09-08T07:05')).toEqual(new Date(2025, 8, 8, 7, 5))
    expect(parseIsoLocalDateTime('2025-09-00T07:05').getTime()).toBeNaN()
  })

  it('formata o horário com dois dígitos', () => {
    expect(formatTime(new Date(2025, 8, 8, 7, 5))).toBe('07:05')
    expect(formatTime(new Date(2025, 8, 8, 19, 30))).toBe('19:30')
  })
})
