import { describe, expect, it } from 'vitest'
import { endsWithinAgenda, startsWithinAgenda, TIME_SLOTS } from './agenda'

describe('startsWithinAgenda', () => {
  it('aceita do início da grade até a última meia hora', () => {
    expect(startsWithinAgenda('07:00')).toBe(true)
    expect(startsWithinAgenda('12:35')).toBe(true)
    expect(startsWithinAgenda('19:55')).toBe(true)
  })

  it('recusa horários que não existem na grade', () => {
    expect(startsWithinAgenda('06:55')).toBe(false)
    expect(startsWithinAgenda('00:00')).toBe(false)
    expect(startsWithinAgenda('20:00')).toBe(false)
    expect(startsWithinAgenda('23:30')).toBe(false)
  })
})

describe('endsWithinAgenda', () => {
  it('aceita a sessão que termina às 20:00 em ponto', () => {
    expect(endsWithinAgenda('19:30', 30)).toBe(true)
    expect(endsWithinAgenda('18:30', 90)).toBe(true)
  })

  it('recusa a sessão que passa das 20:00', () => {
    expect(endsWithinAgenda('19:30', 45)).toBe(false)
    expect(endsWithinAgenda('19:00', 90)).toBe(false)
  })
})

describe('TIME_SLOTS', () => {
  it('vai de 15 em 15 minutos, da abertura até o último quarto de hora antes do fim', () => {
    expect(TIME_SLOTS[0]).toBe('07:00')
    expect(TIME_SLOTS[1]).toBe('07:15')
    expect(TIME_SLOTS.at(-1)).toBe('19:45')
    expect(TIME_SLOTS).toHaveLength(52)
  })

  it('só tem horários em que uma sessão pode começar', () => {
    expect(TIME_SLOTS.every(startsWithinAgenda)).toBe(true)
  })
})
