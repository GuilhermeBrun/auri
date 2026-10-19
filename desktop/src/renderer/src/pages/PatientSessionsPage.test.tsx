// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { fakeAppointment, fakePatient, renderRoute, AVALIACAO } from '@renderer/testing'
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
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  })) as unknown as typeof window.matchMedia
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
  ...AVALIACAO
})
const missed = fakeAppointment({ inicio: '2026-09-12T14:00', presenca: 'falta' })
const ASSINADO_EM = new Date(2026, 8, 5, 13, 52).toISOString()
const plain = fakeAppointment({
  inicio: '2026-09-05T14:00',
  presenca: 'presente',
  assinatura: {
    id: 7,
    signer_nome: 'Marina Fictícia Andrade',
    signer_parentesco: 'Mãe',
    assinado_em: ASSINADO_EM
  }
})
const TRACO = 'AQRkyAGQA58BkAOYApAD7wE'
const older = fakeAppointment({ inicio: '2025-12-05T14:00' })
const soon = fakeAppointment({ inicio: '2026-10-15T09:00' })
const later = fakeAppointment({ inicio: '2026-10-24T14:00', ...AVALIACAO })
const today = fakeAppointment({ inicio: '2026-10-14T18:00' })

let api: {
  patients: Record<string, ReturnType<typeof vi.fn>>
  appointments: Record<string, ReturnType<typeof vi.fn>>
  attendance: Record<string, ReturnType<typeof vi.fn>>
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
    },
    attendance: {
      listByPatient: vi.fn(async () => [
        {
          id: 7,
          appointment_id: plain.id,
          inicio: plain.inicio,
          fim: plain.fim,
          tipo_nome: 'Sessão',
          categoria: 'sessao',
          signer_nome: 'Marina Fictícia Andrade',
          signer_papel: 'mae',
          signer_parentesco: 'Mãe',
          traco: TRACO,
          assinado_em: ASSINADO_EM,
          fuso_minutos: -240,
          computador: 'Recepção',
          registro_sha256: 'a'.repeat(64),
          anulada: null
        }
      ]),
      void: vi.fn(async () => ({ ...plain, assinatura: null })),
      sign: vi.fn(async () => today)
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
    expect(within(proximas).getByText('Sessão · hoje')).toBeTruthy()
    expect(within(proximas).getByText('Sessão · amanhã')).toBeTruthy()
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
        tipo_id: 2,
        etiquetas: [],
        presenca: '',
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

  it('mostra quem assinou a chegada e marca as presenças sem assinatura', async () => {
    open()
    expect(await screen.findByText('Mãe · 13:52')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Assinatura de Marina Fictícia Andrade' })).toBeTruthy()
    expect(screen.getByText('sem assinatura')).toBeTruthy()
    expect(screen.getByText(/1 assinada/)).toBeTruthy()
  })

  it('sessão assinada fica travada e pode ter a assinatura anulada com motivo', async () => {
    open()
    await userEvent.click(await screen.findByText('Mãe · 13:52'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/chegada assinada às 13:52/)).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Excluir' })).toBeNull()
    expect(within(dialog).queryByRole('group', { name: 'Presença' })).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular assinatura' }))
    await userEvent.type(within(dialog).getByLabelText('Por que anular?'), 'Sessão errada')
    const anular = within(dialog).getAllByRole('button', { name: 'Anular assinatura' }).at(-1)!
    await userEvent.click(anular)
    await waitFor(() =>
      expect(api.attendance.void).toHaveBeenCalledWith(7, 'Sessão errada', 'Este computador')
    )
  })

  it('sessão de hoje oferece assinar a chegada, com o responsável já escolhido', async () => {
    open()
    const proximas = (await screen.findByRole('heading', { name: 'Próximas' })).parentElement!
    await userEvent.click(within(proximas).getByText('Sessão · hoje'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Assinar chegada/ }))
    expect(await screen.findByText('Quem está assinando')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Marina Fictícia Andrade/, pressed: true })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirmar chegada/ }).hasAttribute('disabled')).toBe(
      true
    )
    await userEvent.click(screen.getByRole('button', { name: 'Outra pessoa' }))
    expect(screen.getByLabelText('Nome de quem assina')).toBeTruthy()
  })
})
