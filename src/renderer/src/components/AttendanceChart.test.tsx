// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { fakeAppointment } from '@renderer/testing'
import { AttendanceChart } from './AttendanceChart'

afterEach(cleanup)

// da mais nova para a mais antiga, como a lista da aba Sessões
const sessions = [
  fakeAppointment({
    inicio: '2026-10-10T14:00',
    presenca: 'presente',
    evolucao: '/r/ em palavras.'
  }),
  fakeAppointment({ inicio: '2026-10-03T14:00', presenca: 'desmarcou' }),
  fakeAppointment({ inicio: '2026-09-26T14:00', presenca: 'presente', tipo: 'avaliacao' }),
  fakeAppointment({ inicio: '2026-09-19T14:00', presenca: 'falta' }),
  fakeAppointment({ inicio: '2026-09-12T14:00' })
]

describe('gráfico de frequência', () => {
  it('calcula a frequência só sobre as sessões com presença registrada', () => {
    render(<AttendanceChart sessions={sessions} onOpen={() => {}} />)
    expect(screen.getByText('50% · 2 de 4')).toBeTruthy()
    for (const label of ['2 presenças', '1 falta', '1 desmarcada', '1 sem registro'])
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
  })

  it('passar o mouse mostra a sessão na linha de baixo; sair volta à dica', () => {
    render(<AttendanceChart sessions={sessions} onOpen={() => {}} />)
    const bar = screen.getByRole('button', { name: /26 de setembro, Presente/ })
    fireEvent.mouseEnter(bar)
    expect(screen.getByText(/Presente · Avaliação/)).toBeTruthy()
    fireEvent.mouseEnter(screen.getByRole('button', { name: /10 de outubro, Presente/ }))
    expect(screen.getByText(/— \/r\/ em palavras\./)).toBeTruthy()
    fireEvent.mouseLeave(bar.parentElement!.parentElement!)
    expect(screen.getByText('Passe o mouse para ver cada sessão.')).toBeTruthy()
  })

  it('setas, Home e End percorrem as sessões; Enter e clique abrem o registro', async () => {
    const onOpen = vi.fn()
    render(<AttendanceChart sessions={sessions} onOpen={onOpen} />)
    const last = screen.getByRole('button', { name: /10 de outubro/ })
    last.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/3 de outubro, Desmarcou/)
    await userEvent.keyboard('{Home}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(
      /12 de setembro, Sem registro/
    )
    await userEvent.keyboard('{ArrowLeft}{End}{a}')
    expect(document.activeElement).toBe(last)
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith(sessions[0])
    fireEvent.blur(last)
  })

  it('a legenda acende um tipo ao passar o mouse e fixa ao clicar', async () => {
    render(<AttendanceChart sessions={sessions} onOpen={() => {}} />)
    const faltas = screen.getByRole('button', { name: '1 falta' })
    fireEvent.mouseEnter(faltas)
    fireEvent.mouseLeave(faltas)
    await userEvent.click(faltas)
    expect(faltas.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(faltas)
    expect(faltas.getAttribute('aria-pressed')).toBe('false')
  })

  it('sem presença registrada e com muitas sessões, diz isso em texto', () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      fakeAppointment({
        inicio: `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}T08:00`
      })
    )
    render(<AttendanceChart sessions={many} onOpen={() => {}} />)
    expect(screen.getByText('nenhuma presença marcada')).toBeTruthy()
    expect(screen.getByText(/Últimas 40 sessões/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Sem registro/ })).toHaveLength(40)
  })
})
