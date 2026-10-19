// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { fakeAppointment, fakePatient, renderRoute } from '@renderer/testing'
import type { ToastInput } from '@renderer/lib/toast'

vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  Object.assign(window, {
    platform: 'darwin',
    backup: bridge(),
    connection: bridge(),
    prefs: bridge()
  })
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }
})

import { PatientSessionsRoute } from './PatientSessionsPage'

const NOW = new Date(2026, 9, 14, 15, 0)
const patient = fakePatient({ ativo: false })
const past = fakeAppointment({
  inicio: '2026-10-10T14:00',
  presenca: 'presente',
  evolucao: 'Treino de /r/ em sílabas.',
  tipo: 'avaliacao'
})
const missed = fakeAppointment({ inicio: '2026-09-12T14:00', presenca: 'falta' })
const plain = fakeAppointment({ inicio: '2026-09-05T14:00', presenca: 'presente' })
const older = fakeAppointment({ inicio: '2025-12-05T14:00' })
const soon = fakeAppointment({ inicio: '2026-10-15T09:00' })
const later = fakeAppointment({ inicio: '2026-10-24T14:00', tipo: 'avaliacao' })
const today = fakeAppointment({ inicio: '2026-10-14T18:00' })

let api: {
  patients: Record<string, ReturnType<typeof vi.fn>>
  appointments: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api = {
    patients: {
      get: vi.fn(async () => patient),
      list: vi.fn(async () => [patient])
    },
    appointments: {
      listByPatient: vi.fn(async () => [later, soon, today, past, missed, plain, older]),
      remove: vi.fn(async () => undefined),
      create: vi.fn(async () => past)
    }
  }
  Object.assign(window, { api })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = (toast?: (t: ToastInput) => void): ReturnType<typeof renderRoute> =>
  renderRoute('/pacientes/1/sessoes', '/pacientes/:id/sessoes', <PatientSessionsRoute />, toast)

describe('aba Sessões do paciente', () => {
  it('separa próximas e anteriores, agrupa por mês e mostra presença e evolução', async () => {
    open()
    expect(await screen.findByRole('heading', { name: 'Próximas' })).toBeTruthy()
    const proximas = screen.getByRole('heading', { name: 'Próximas' }).parentElement!
    expect(within(proximas).getByText('hoje')).toBeTruthy()
    expect(within(proximas).getByText('amanhã')).toBeTruthy()
    expect(within(proximas).getByText('Avaliação · em 10 dias')).toBeTruthy()
    expect(screen.getByText('Outubro')).toBeTruthy()
    expect(screen.getByText('Dezembro de 2025')).toBeTruthy()
    expect(screen.getByText('Treino de /r/ em sílabas.')).toBeTruthy()
    expect(screen.getByText('Sem evolução')).toBeTruthy()
    expect(screen.getAllByText('Faltou').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sem registro').length).toBeGreaterThan(0)
    expect(screen.getByText('Inativo')).toBeTruthy()
  })

  it('sem sessões, convida a agendar e abre o agendamento com o paciente escolhido', async () => {
    api.appointments.listByPatient.mockResolvedValue([])
    open()
    await userEvent.click(await screen.findByRole('button', { name: /Agendar sessão/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Helena Fictícia Andrade')).toBeTruthy()
  })

  it('falha ao abrir mostra o erro e tenta de novo', async () => {
    api.appointments.listByPatient.mockRejectedValueOnce(new Error('database is locked'))
    open()
    expect(await screen.findByText('Não foi possível abrir as sessões')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(await screen.findByRole('heading', { name: 'Anteriores' })).toBeTruthy()
  })

  it('excluir pede confirmação e o aviso permite desfazer', async () => {
    const toast = vi.fn()
    open(toast)
    const row = await screen.findByText('Treino de /r/ em sílabas.')
    await userEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(api.appointments.remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: /Excluir com a evolução/ }))
    await waitFor(() => expect(api.appointments.remove).toHaveBeenCalledWith(past.id))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    const notice = toast.mock.calls[0][0] as ToastInput
    expect(notice.title).toBe('Agendamento excluído')
    notice.action!.onClick()
    await waitFor(() =>
      expect(api.appointments.create).toHaveBeenCalledWith({
        patient_id: past.patient_id,
        inicio: past.inicio,
        fim: past.fim,
        observacao: '',
        tipo: 'avaliacao',
        presenca: 'presente',
        evolucao: 'Treino de /r/ em sílabas.'
      })
    )
    await waitFor(() =>
      expect(toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Agendamento restaurado' })
      )
    )
  })

  it('o botão de nova sessão e a aba Ficha', async () => {
    open()
    await screen.findByRole('heading', { name: 'Próximas' })
    await userEvent.click(screen.getByRole('button', { name: 'Nova sessão' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    const partes = screen.getByRole('navigation', { name: 'Partes do paciente' })
    expect(within(partes).getByRole('link', { name: 'Sessões' }).getAttribute('aria-current')).toBe(
      'page'
    )
    await userEvent.click(within(partes).getByRole('link', { name: 'Ficha' }))
    expect(await screen.findByText('Outra tela')).toBeTruthy()
  })
})
