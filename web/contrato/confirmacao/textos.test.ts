import { describe, expect, test } from 'vite-plus/test'
import { confirmacaoFicticia, ENVIO_FICTICIO } from './ficticio'
import {
  diaPorExtenso,
  hora,
  horario,
  mensagemDaIda,
  mensagemDaVolta,
  politica,
  prazo,
  quando
} from './textos'

const confirmacao = confirmacaoFicticia()
const agora = ENVIO_FICTICIO * 1000

describe('textos da confirmação', () => {
  test('dia e hora no fuso da clínica, não no do aparelho', () => {
    expect(hora(confirmacao.ses.ini, -240)).toBe('14:00')
    expect(hora(confirmacao.ses.ini, -180)).toBe('15:00')
    expect(horario(confirmacao)).toBe('14:00 às 14:50')
    expect(quando(confirmacao)).toBe('quinta-feira, 22/10, às 14:00')
    expect(diaPorExtenso(confirmacao.ses.ini, confirmacao.tz)).toBe('Quinta-feira, 22 de outubro')
  })

  test('meia-noite vira o dia certo no fuso da clínica', () => {
    const ini = Math.floor(Date.UTC(2026, 9, 23, 3, 30) / 1000)
    expect(quando(confirmacaoFicticia({ ses: { ini, dur: 30, prof: 'F' } }))).toBe(
      'quinta-feira, 22/10, às 23:30'
    )
  })

  test('prazo de hoje ou de outro dia', () => {
    expect(prazo(confirmacao, agora)).toBe('até as 10:30 de hoje')
    expect(prazo(confirmacao, agora + 86_400_000)).toBe('até 21/10 às 10:30')
  })

  test('política com e sem cobrança', () => {
    expect(politica(confirmacao)).toContain('a sessão é cobrada')
    expect(politica(confirmacaoFicticia({ cob: false }))).not.toContain('cobrada')
  })

  test('mensagem que a clínica manda', () => {
    expect(mensagemDaIda(confirmacao, 'https://auri.dev.br/confirmar#1.a.b')).toBe(
      'Olá! A Clínica Exemplo pede a confirmação da sessão de Ana Beatriz com Fernanda na quinta-feira, 22/10, às 14:00.\n' +
        'Responda pelo link até as 10:30. Sem resposta até lá, o horário fica livre para outro paciente e a sessão é cobrada.\n' +
        'https://auri.dev.br/confirmar#1.a.b'
    )
  })

  test('sábado e domingo levam "no"', () => {
    const sabado = Math.floor(Date.UTC(2026, 9, 24, 13) / 1000)
    const mensagem = mensagemDaIda(
      confirmacaoFicticia({ ses: { ini: sabado, dur: 50, prof: 'Fernanda' } }),
      'x'
    )
    expect(mensagem).toContain('com Fernanda no sábado, 24/10, às 09:00.')
  })

  test('mensagem que o paciente devolve', () => {
    expect(mensagemDaVolta(confirmacao, 'confirmada', 'L')).toBe(
      'Sessão confirmada: Ana Beatriz · quinta-feira, 22/10, às 14:00\nL'
    )
    expect(mensagemDaVolta(confirmacao, 'desmarcada', 'L')).toMatch(/^Sessão desmarcada: /)
  })
})
