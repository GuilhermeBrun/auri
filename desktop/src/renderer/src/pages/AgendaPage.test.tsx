// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO, type Funcionamento } from '@shared/agenda'
import type { Appointment, Clinic } from '@shared/schemas'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { fakeAppointment, fakePatient, renderRoute } from '@renderer/testing'

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
  globalThis.requestIdleCallback ??= (() => 0) as unknown as typeof requestIdleCallback
  globalThis.cancelIdleCallback ??= () => {}
  Object.defineProperty(document, 'elementFromPoint', { value: () => null, configurable: true })
})

import { AgendaPage } from './AgendaPage'

const NOW = new Date(2026, 9, 14, 10, 0)

function clinicWith(funcionamento: Funcionamento): Clinic {
  return {
    nome: 'Clínica Fictícia',
    documento: '',
    endereco: '',
    telefone: '',
    whatsapp: '',
    profissional: '',
    registro: '',
    logo: '',
    margem_deslocamento: 30,
    funcionamento,
    updated_at: '2026-10-01T00:00:00.000Z'
  }
}

const confirmada = fakeAppointment({
  inicio: '2026-10-12T09:00',
  patient_nome: 'Ana Fictícia Lima',
  confirmado_em: '2026-10-11T15:00:00.000Z'
})
const avaliacao = fakeAppointment({
  inicio: '2026-10-14T14:00',
  fim: '2026-10-14T15:00',
  patient_nome: 'Bruno Fictício Reis',
  tipo: 'avaliacao'
})
const sabado = fakeAppointment({ inicio: '2026-10-17T11:00', patient_nome: 'Caio Fictício' })

let api: {
  clinic: Record<string, ReturnType<typeof vi.fn>>
  appointments: Record<string, ReturnType<typeof vi.fn>>
  patients: Record<string, ReturnType<typeof vi.fn>>
  attendance: Record<string, ReturnType<typeof vi.fn>>
}

function setup(appointments: Appointment[], funcionamento = FUNCIONAMENTO_PADRAO): void {
  api = {
    clinic: { get: vi.fn(async () => clinicWith(funcionamento)) },
    appointments: {
      listRange: vi.fn(async () => appointments),
      create: vi.fn(async (input) => fakeAppointment(input)),
      update: vi.fn(async (_id, input) => fakeAppointment(input))
    },
    patients: { list: vi.fn(async () => [fakePatient()]) },
    attendance: { listByPatient: vi.fn(async () => []) }
  }
  Object.assign(window, { api })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const headers = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.rbc-time-header .rbc-header'))
const eventOf = async (nome: string): Promise<HTMLElement> =>
  (await screen.findByText(nome, { selector: '.name-full' })).closest<HTMLElement>('.rbc-event')!

const shownHeaders = (): string[] =>
  headers()
    .filter((h) => !h.classList.contains('day-hidden'))
    .map((h) => h.textContent ?? '')

describe('agenda da semana', () => {
  it('mostra só os dias abertos: de segunda a sábado', async () => {
    setup([confirmada, avaliacao, sabado])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    await eventOf('Bruno Fictício Reis')
    await waitFor(() => expect(shownHeaders()).toHaveLength(6))
    expect(shownHeaders()[0]).toMatch(/^seg/)
    expect(shownHeaders().at(-1)).toMatch(/^sáb/)
    expect(screen.getByRole('heading', { name: /12 a 17 de outubro 2026/ })).toBeTruthy()
  })

  it('mostra um dia fechado quando ele tem sessão marcada', async () => {
    const domingo = fakeAppointment({ inicio: '2026-10-11T09:00', patient_nome: 'Davi Fictício' })
    setup([domingo])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    await eventOf('Davi Fictício')
    await waitFor(() => expect(shownHeaders()).toHaveLength(7))
  })

  it('pinta como fechado o sábado à tarde e não o resto da semana', async () => {
    setup([sabado])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    await eventOf('Caio Fictício')
    await waitFor(() => expect(shownHeaders()).toHaveLength(6))
    const columns = Array.from(document.querySelectorAll<HTMLElement>('.rbc-day-slot')).filter(
      (c) => !c.classList.contains('day-hidden')
    )
    const closed = (column: HTMLElement): number =>
      column.querySelectorAll('.rbc-time-slot.slot-closed').length
    expect(closed(columns[0])).toBe(0)
    expect(closed(columns.at(-1)!)).toBe(16)
    expect(document.querySelector('.rbc-time-gutter [data-meia="09:30"]')).toBeTruthy()
    expect(document.querySelector('.rbc-time-gutter [data-meia="09:00"]')).toBeNull()
  })

  it('mostra o tipo de toda sessão e marca a confirmada', async () => {
    setup([confirmada, avaliacao, sabado])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    const ana = await eventOf('Ana Fictícia Lima')
    expect(within(ana).getByText(/Sessão/)).toBeTruthy()
    expect(within(ana).getByLabelText('Confirmado')).toBeTruthy()
    const bruno = await eventOf('Bruno Fictício Reis')
    expect(within(bruno).getByText(/Avaliação · 14:00 – 15:00/)).toBeTruthy()
    expect(within(bruno).queryByLabelText('Confirmado')).toBeNull()
  })

  it('na visão Dia, as setas pulam o domingo', async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0))
    setup([])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Dia' }))
    expect(await screen.findByRole('heading', { name: /sábado, 17 de outubro/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(
      await screen.findByRole('heading', { name: /segunda-feira, 19 de outubro/ })
    ).toBeTruthy()
  })
})

const draftAt = (inicio: Date, duracao = 30): AppointmentDraft => ({
  mode: 'create',
  inicio,
  duracao,
  patient: { id: 1, nome: 'Helena Fictícia Andrade' }
})

describe('agendamento e funcionamento', () => {
  it('não deixa agendar no domingo nem passar do meio-dia no sábado', async () => {
    setup([])
    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={draftAt(new Date(2026, 9, 18, 9, 0))} onClose={() => {}} />
    )
    await waitFor(() => expect(api.clinic.get).toHaveBeenCalled())
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar' }))
    expect(await screen.findByText('A clínica não abre no domingo')).toBeTruthy()
    expect(api.appointments.create).not.toHaveBeenCalled()
    cleanup()

    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={draftAt(new Date(2026, 9, 17, 11, 30), 60)} onClose={() => {}} />
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar' }))
    expect(await screen.findByText('Passa das 12:00')).toBeTruthy()
    expect(api.appointments.create).not.toHaveBeenCalled()
  })

  it('oferece os horários do dia e agenda dentro do funcionamento', async () => {
    setup([])
    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={draftAt(new Date(2026, 9, 17, 11, 30))} onClose={() => {}} />
    )
    await waitFor(() => expect(api.clinic.get).toHaveBeenCalled())
    await userEvent.click(screen.getByLabelText('Hora'))
    const options = await screen.findAllByRole('option')
    expect(options.at(-1)?.textContent).toBe('11:45')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }))
    await waitFor(() =>
      expect(api.appointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inicio: '2026-10-17T11:30',
          fim: '2026-10-17T12:00',
          confirmado: false
        })
      )
    )
  })

  it('marca a sessão como confirmada antes de ela começar', async () => {
    const amanha = fakeAppointment({ inicio: '2026-10-15T09:00' })
    setup([amanha])
    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={{ mode: 'edit', appointment: amanha }} onClose={() => {}} />
    )
    const confirmado = await screen.findByRole('switch', { name: 'Confirmado' })
    expect(confirmado.getAttribute('aria-checked')).toBe('false')
    await userEvent.click(confirmado)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(api.appointments.update).toHaveBeenCalledWith(
        amanha.id,
        expect.objectContaining({ confirmado: true }),
        amanha.updated_at
      )
    )
  })

  it('não mostra a confirmação depois que a sessão começou', async () => {
    const passada = fakeAppointment({ inicio: '2026-10-13T09:00', confirmado_em: null })
    setup([passada])
    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={{ mode: 'edit', appointment: passada }} onClose={() => {}} />
    )
    await screen.findByRole('button', { name: 'Salvar alterações' })
    expect(screen.queryByRole('switch', { name: 'Confirmado' })).toBeNull()
  })
})
