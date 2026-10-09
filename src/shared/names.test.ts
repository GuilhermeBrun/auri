import { describe, expect, it } from 'vitest'
import { shortName } from './names'

describe('shortName', () => {
  it('mantém os dois primeiros nomes', () => {
    expect(shortName('Helena Prado Albuquerque')).toBe('Helena Prado')
    expect(shortName('Pedro Henrique Lima')).toBe('Pedro Henrique')
    expect(shortName('Maria Eduarda Vasconcelos de Albuquerque Santos')).toBe('Maria Eduarda')
  })

  it('não mexe em nomes de uma ou duas palavras', () => {
    expect(shortName('Alice')).toBe('Alice')
    expect(shortName('Laura Menezes')).toBe('Laura Menezes')
  })

  it('pula partículas depois do primeiro nome', () => {
    expect(shortName('Ana de Souza Lima')).toBe('Ana Souza')
    expect(shortName('João dos Santos')).toBe('João Santos')
  })

  it('ignora espaços sobrando e aceita vazio', () => {
    expect(shortName('  Theo   Barros  Cardoso ')).toBe('Theo Barros')
    expect(shortName('')).toBe('')
  })
})
