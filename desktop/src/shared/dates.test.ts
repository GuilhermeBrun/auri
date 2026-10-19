import { describe, expect, it } from 'vite-plus/test'
import {
  brDateToIso,
  formatAge,
  formatTime,
  isIsoDate,
  isIsoLocalDateTime,
  isoToBrDate,
  maskBrDate,
  maskTime,
  normalizeTime,
  parseIsoDate,
  parseIsoLocalDateTime
} from './dates'

const today = new Date(2025, 8, 7)

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

  it('mostra anos e meses a partir de 1 ano', () => {
    expect(formatAge('2024-09-07', today)).toBe('1 ano')
    expect(formatAge('2024-08-07', today)).toBe('1 ano e 1 mês')
    expect(formatAge('2019-08-17', today)).toBe('6 anos')
    expect(formatAge('2019-05-07', today)).toBe('6 anos e 4 meses')
    expect(formatAge('2019-05-08', today)).toBe('6 anos e 3 meses')
    expect(formatAge('2014-09-08', today)).toBe('10 anos e 11 meses')
    expect(formatAge('2015-09-07', today)).toBe('10 anos')
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

describe('data digitada (dd/mm/aaaa)', () => {
  it('converte nos dois sentidos', () => {
    expect(isoToBrDate('2026-10-07')).toBe('07/10/2026')
    expect(brDateToIso('07/10/2026')).toBe('2026-10-07')
  })

  it('devolve vazio para o que não é data', () => {
    expect(isoToBrDate('')).toBe('')
    expect(isoToBrDate('2026-02-30')).toBe('')
    expect(brDateToIso('07/10/26')).toBe('')
    expect(brDateToIso('30/02/2026')).toBe('')
    expect(brDateToIso('31/04/2026')).toBe('')
  })

  it('aplica a máscara enquanto digita', () => {
    expect(maskBrDate('0')).toBe('0')
    expect(maskBrDate('071')).toBe('07/1')
    expect(maskBrDate('07102')).toBe('07/10/2')
    expect(maskBrDate('07102026')).toBe('07/10/2026')
    expect(maskBrDate('071020261234')).toBe('07/10/2026')
    expect(maskBrDate('07/10/2026')).toBe('07/10/2026')
    expect(maskBrDate('ab')).toBe('')
  })

  it('completa dia e mês de um dígito quando a barra é digitada', () => {
    expect(maskBrDate('7/')).toBe('07')
    expect(maskBrDate('7/10/2026')).toBe('07/10/2026')
    expect(maskBrDate('07/1/2026')).toBe('07/01/2026')
    expect(maskBrDate('7/1/2026')).toBe('07/01/2026')
  })
})

describe('hora digitada (HH:mm)', () => {
  it('aplica a máscara enquanto digita', () => {
    expect(maskTime('1')).toBe('1')
    expect(maskTime('18')).toBe('18')
    expect(maskTime('180')).toBe('18:0')
    expect(maskTime('1800')).toBe('18:00')
    expect(maskTime('18:00')).toBe('18:00')
    expect(maskTime('180099')).toBe('18:00')
  })

  it('põe o zero na hora que começa com 3 a 9, ou com um dígito seguido de separador', () => {
    expect(maskTime('9')).toBe('09')
    expect(maskTime('930')).toBe('09:30')
    expect(maskTime('9:30')).toBe('09:30')
    expect(maskTime('1:30')).toBe('01:30')
  })

  it('completa o que falta', () => {
    expect(normalizeTime('09:30')).toBe('09:30')
    expect(normalizeTime('09')).toBe('09:00')
    expect(normalizeTime('9')).toBe('09:00')
    expect(normalizeTime('09:3')).toBe('09:30')
    expect(normalizeTime('')).toBeNull()
  })

  it('recusa horas que não existem', () => {
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('12:60')).toBeNull()
    expect(normalizeTime('123456')).toBeNull()
  })
})
