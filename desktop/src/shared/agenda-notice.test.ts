import { describe, expect, it } from 'vite-plus/test'
import { noticeText, noticeWhen, type AgendaNotice } from './agenda-notice'

const HOJE = new Date(2026, 9, 20, 9, 0)

const notice = (change: Partial<AgendaNotice>): AgendaNotice => ({
  change: 'marcou',
  kind: 'sessao',
  nome: 'Ana Souza',
  inicio: '2026-10-23T14:00',
  autor: 'Recepção',
  ...change
})

describe('texto do aviso da agenda', () => {
  it('diz o dia pelo nome quando é perto', () => {
    expect(noticeWhen('2026-10-20T14:00', HOJE)).toBe('hoje às 14:00')
    expect(noticeWhen('2026-10-21T08:30', HOJE)).toBe('amanhã às 08:30')
    expect(noticeWhen('2026-10-19T10:00', HOJE)).toBe('ontem às 10:00')
    expect(noticeWhen('2026-10-23T14:00', HOJE)).toBe('sex, 23/10 às 14:00')
  })

  it('diz quem mudou, o quê e quando', () => {
    expect(noticeText(notice({}), HOJE)).toEqual({
      title: 'Recepção marcou a sessão de Ana Souza',
      body: 'Sex, 23/10 às 14:00'
    })
    expect(noticeText(notice({ change: 'faltou' }), HOJE).title).toBe(
      'Recepção marcou falta de Ana Souza'
    )
    expect(
      noticeText(notice({ kind: 'compromisso', nome: 'Reunião', change: 'excluiu' }), HOJE).title
    ).toBe('Recepção excluiu Reunião')
  })

  it('remarcada mostra o horário novo e o antigo', () => {
    expect(noticeText(notice({ change: 'remarcou', antes: '2026-10-20T10:00' }), HOJE).body).toBe(
      'Agora sex, 23/10 às 14:00, era hoje às 10:00'
    )
  })

  it('chegada fala do paciente e de onde assinou', () => {
    expect(noticeText(notice({ change: 'chegou', inicio: '2026-10-20T14:00' }), HOJE)).toEqual({
      title: 'Ana Souza chegou',
      body: 'Hoje às 14:00, assinado em Recepção'
    })
  })
})
