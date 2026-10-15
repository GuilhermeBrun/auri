import { describe, expect, it } from 'vite-plus/test'
import { nextSlot, PRESENCA_OPTIONS, TIPO_OPTIONS } from './session'

const at = (h: number, m: number): Date => new Date(2026, 9, 14, h, m)

describe('próximo horário para agendar', () => {
  it('arredonda para a próxima meia hora ou hora cheia', () => {
    expect(nextSlot(at(9, 10))).toEqual(at(9, 30))
    expect(nextSlot(at(9, 40))).toEqual(at(10, 0))
  })

  it('antes do expediente sugere o começo do dia', () => {
    expect(nextSlot(at(5, 20))).toEqual(at(7, 0))
  })

  it('sem lugar para uma sessão padrão hoje, sugere o começo de amanhã', () => {
    expect(nextSlot(at(19, 40))).toEqual(new Date(2026, 9, 15, 7, 0))
  })

  it('oferece os tipos e as presenças com os nomes da ficha', () => {
    expect(TIPO_OPTIONS).toEqual([
      ['sessao', 'Sessão'],
      ['avaliacao', 'Avaliação']
    ])
    expect(PRESENCA_OPTIONS.map(([, label]) => label)).toEqual(['Presente', 'Faltou', 'Desmarcou'])
  })
})
