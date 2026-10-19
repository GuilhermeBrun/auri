import { describe, expect, it } from 'vite-plus/test'
import { esperaTexto, horarioTexto, preferenciasTexto, resumoEspera } from './waitlist'

describe('textos da lista de espera', () => {
  it('resume as preferências em frase', () => {
    expect(resumoEspera('Sessão', 30, [], [])).toBe('Sessão de 30 min, em qualquer dia e horário.')
    expect(resumoEspera('Sessão', 45, [1, 3, 6], ['tarde'])).toBe(
      'Sessão de 45 min, segunda, quarta ou sábado, à tarde.'
    )
    expect(resumoEspera('Avaliação', 60, [], ['manha', 'noite'])).toBe(
      'Avaliação de 60 min, qualquer dia, de manhã ou à noite.'
    )
  })

  it('resume as preferências curtas para a lista', () => {
    expect(preferenciasTexto([], [])).toBe('Qualquer dia e horário')
    expect(preferenciasTexto([2, 4], [])).toBe('ter, qui · qualquer horário')
    expect(preferenciasTexto([], ['manha'])).toBe('qualquer dia · manhã')
  })

  it('conta os dias de espera', () => {
    const now = new Date(2026, 9, 19, 9, 0)
    expect(esperaTexto(new Date(2026, 9, 19, 8, 0).toISOString(), now)).toBe('Entrou hoje')
    expect(esperaTexto(new Date(2026, 9, 18, 18, 0).toISOString(), now)).toBe('Esperando há 1 dia')
    expect(esperaTexto(new Date(2026, 9, 5, 18, 0).toISOString(), now)).toBe('Esperando há 14 dias')
  })

  it('escreve o horário com o dia da semana', () => {
    expect(horarioTexto({ inicio: '2026-10-21T14:00', fim: '2026-10-21T14:45' })).toBe(
      'qua, 21 de out · 14:00–14:45'
    )
  })
})
