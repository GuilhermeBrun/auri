import { describe, expect, it } from 'vite-plus/test'
import { aniversariantes, idadeQueCompleta } from './aniversarios'

describe('idadeQueCompleta', () => {
  it('devolve a idade só no dia e mês do nascimento', () => {
    expect(idadeQueCompleta('2018-10-20', new Date(2026, 9, 20))).toBe(8)
    expect(idadeQueCompleta('2018-10-20', new Date(2026, 9, 20, 23, 59))).toBe(8)
    expect(idadeQueCompleta('2018-10-20', new Date(2026, 9, 21))).toBeNull()
    expect(idadeQueCompleta('2018-10-20', new Date(2026, 8, 20))).toBeNull()
  })

  it('ignora data vazia, inválida, futura e o próprio dia do nascimento', () => {
    expect(idadeQueCompleta('', new Date(2026, 9, 20))).toBeNull()
    expect(idadeQueCompleta('2018-02-30', new Date(2026, 1, 28))).toBeNull()
    expect(idadeQueCompleta('2027-10-20', new Date(2026, 9, 20))).toBeNull()
    expect(idadeQueCompleta('2026-10-20', new Date(2026, 9, 20))).toBeNull()
  })

  it('29/02 vira 28/02 em ano não bissexto e fica em 29/02 no bissexto', () => {
    expect(idadeQueCompleta('2016-02-29', new Date(2027, 1, 28))).toBe(11)
    expect(idadeQueCompleta('2016-02-29', new Date(2027, 2, 1))).toBeNull()
    expect(idadeQueCompleta('2016-02-29', new Date(2028, 1, 29))).toBe(12)
    expect(idadeQueCompleta('2016-02-29', new Date(2028, 1, 28))).toBeNull()
    expect(idadeQueCompleta('2000-02-29', new Date(2100, 1, 28))).toBe(100)
    expect(idadeQueCompleta('2015-02-28', new Date(2028, 1, 28))).toBe(13)
  })
})

describe('aniversariantes', () => {
  it('lista os aniversariantes do dia em ordem alfabética', () => {
    const pacientes = [
      { id: 1, nome: 'Bruno Lima', data_nascimento: '2019-10-20' },
      { id: 2, nome: 'Álvaro Reis', data_nascimento: '2015-10-20' },
      { id: 3, nome: 'Carla Dias', data_nascimento: '2015-10-21' },
      { id: 4, nome: 'Davi Melo', data_nascimento: '' }
    ]
    expect(aniversariantes(pacientes, new Date(2026, 9, 20))).toEqual([
      { id: 2, nome: 'Álvaro Reis', idade: 11 },
      { id: 1, nome: 'Bruno Lima', idade: 7 }
    ])
    expect(aniversariantes(pacientes, new Date(2026, 9, 22))).toEqual([])
  })
})
