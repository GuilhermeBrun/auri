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

import { PatientEvolutionsRoute } from './PatientEvolutionsPage'

const NOW = new Date(2026, 9, 14, 15, 0)
const patient = fakePatient()
const recent = fakeAppointment({
  inicio: '2026-10-10T14:00',
  presenca: 'falta',
  tipo: 'avaliacao',
  evolucao: 'Treino de /r/ em sílabas.\nMãe relata melhora em casa.'
})
const empty = fakeAppointment({ inicio: '2026-10-03T14:00', presenca: 'presente' })
const september = fakeAppointment({
  inicio: '2026-09-12T09:00',
  presenca: 'presente',
  evolucao: 'Sopro e bolhas.'
})
const lastYear = fakeAppointment({ inicio: '2025-12-05T14:00', evolucao: 'Avaliação inicial.' })

let api: {
  patients: Record<string, ReturnType<typeof vi.fn>>
  appointments: Record<string, ReturnType<typeof vi.fn>>
  attendance: Record<string, ReturnType<typeof vi.fn>>
  documents: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api = {
    patients: { get: vi.fn(async () => patient), list: vi.fn(async () => [patient]) },
    appointments: {
      listByPatient: vi.fn(async () => [recent, empty, september, lastYear])
    },
    attendance: { listByPatient: vi.fn(async () => []) },
    documents: { evolutionsPdf: vi.fn(async () => '/Documentos/Evolução.pdf') }
  }
  Object.assign(window, { api })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = (toast?: (t: ToastInput) => void): ReturnType<typeof renderRoute> =>
  renderRoute(
    '/pacientes/1/evolucoes',
    '/pacientes/:id/evolucoes',
    <PatientEvolutionsRoute />,
    toast
  )

describe('aba Evoluções do paciente', () => {
  it('lista as evoluções da mais recente para a mais antiga, com o texto inteiro', async () => {
    open()
    const first = await screen.findByText(/Treino de \/r\/ em sílabas/)
    expect(first.textContent).toBe('Treino de /r/ em sílabas.\nMãe relata melhora em casa.')
    expect(screen.getByText('14:00–14:30 · Avaliação · Faltou')).toBeTruthy()
    expect(screen.getByText('09:00–09:30 · Sessão · Presente')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Dezembro de 2025' })).toBeTruthy()
    expect(screen.getByText('3 evoluções')).toBeTruthy()
    const texts = screen
      .getAllByRole('button', { name: /Sopro|Treino|Avaliação inicial/ })
      .map((b) => b.textContent)
    expect(texts[0]).toContain('Treino')
    expect(texts[1]).toContain('Sopro')
    expect(texts[2]).toContain('Avaliação inicial')
    const partes = screen.getByRole('navigation', { name: 'Partes do paciente' })
    expect(
      within(partes).getByRole('link', { name: 'Evoluções' }).getAttribute('aria-current')
    ).toBe('page')
  })

  it('filtra pelo período e o relatório sai do período escolhido', async () => {
    const toast = vi.fn()
    open(toast)
    await screen.findByText('3 evoluções')
    await userEvent.click(screen.getByRole('button', { name: 'Mês passado' }))
    expect(screen.getByText('1 evolução')).toBeTruthy()
    expect(screen.queryByText(/Treino/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Relatório de evolução do período' }))
    await waitFor(() =>
      expect(api.documents.evolutionsPdf).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-30')
    )
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Relatório salvo' }))
    )
  })

  it('em Tudo, o relatório vai da primeira à última evolução', async () => {
    open()
    await screen.findByText('3 evoluções')
    await userEvent.click(screen.getByRole('button', { name: 'Relatório de evolução do período' }))
    await waitFor(() =>
      expect(api.documents.evolutionsPdf).toHaveBeenCalledWith(1, '2025-12-05', '2026-10-10')
    )
  })

  it('período sem evoluções oferece ver todas', async () => {
    api.appointments.listByPatient.mockResolvedValue([september])
    open()
    await screen.findByText('1 evolução')
    await userEvent.click(screen.getByRole('button', { name: 'Este mês' }))
    expect(screen.getByText('Nenhuma evolução neste período')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Relatório de evolução do período' })
        .hasAttribute('disabled')
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByText('Sopro e bolhas.')).toBeTruthy()
  })

  it('sem nenhuma evolução, explica onde escrever e leva às sessões', async () => {
    api.appointments.listByPatient.mockResolvedValue([empty])
    open()
    expect(await screen.findByText('Nenhuma evolução ainda')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir sessões' }))
    expect(await screen.findByText('Outra tela')).toBeTruthy()
  })

  it('clicar abre o registro da sessão', async () => {
    open()
    await userEvent.click(await screen.findByText('Sopro e bolhas.'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('Sopro e bolhas.')).toBeTruthy()
  })

  it('falha ao abrir mostra o erro e tenta de novo', async () => {
    api.appointments.listByPatient.mockRejectedValueOnce(new Error('database is locked'))
    open()
    expect(await screen.findByText('Não foi possível abrir as evoluções')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(await screen.findByText('3 evoluções')).toBeTruthy()
  })
})
