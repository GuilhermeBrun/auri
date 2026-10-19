// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '@shared/agenda'
import type { Commitment } from '@shared/commitments'
import type { Appointment, Clinic } from '@shared/schemas'
import type { WaitlistEntry } from '@shared/waitlist'
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

const clinic: Clinic = {
  nome: 'Clínica Fictícia',
  documento: '',
  endereco: '',
  telefone: '',
  whatsapp: '',
  profissional: '',
  registro: '',
  logo: '',
  margem_deslocamento: 30,
  funcionamento: FUNCIONAMENTO_PADRAO,
  updated_at: '2026-10-01T00:00:00.000Z'
}

function commitment(over: Partial<Commitment>): Commitment {
  return {
    id: 1,
    tipo: 'reuniao',
    titulo: '',
    inicio: '2026-10-15T14:00',
    fim: '2026-10-15T15:00',
    observacao: '',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...over
  }
}

const hospital = commitment({ tipo: 'hospital', titulo: 'Hospital Fictício' })
const reserva = commitment({
  id: 2,
  tipo: 'reserva',
  inicio: '2026-10-16T09:00',
  fim: '2026-10-16T10:00'
})

const futura = fakeAppointment({
  inicio: '2026-10-15T09:00',
  fim: '2026-10-15T09:45',
  patient_nome: 'Ana Fictícia Lima'
})

const espera: WaitlistEntry = {
  id: 9,
  patient_id: 3,
  patient_nome: 'Caio Fictício Prado',
  tipo_id: 1,
  tipo_nome: 'Sessão',
  categoria: 'sessao',
  duracao: 45,
  dias: [],
  periodos: [],
  prioridade: 'normal',
  observacao: '',
  created_at: '2026-10-10T12:00:00.000Z',
  updated_at: '2026-10-10T12:00:00.000Z'
}

type Mocks = Record<string, Record<string, ReturnType<typeof vi.fn>>>
let api: Mocks

function setup(appointments: Appointment[] = [], commitments: Commitment[] = []): void {
  api = {
    clinic: { get: vi.fn(async () => clinic) },
    appointments: {
      listRange: vi.fn(async () => appointments),
      create: vi.fn(async (input) => fakeAppointment(input)),
      update: vi.fn(async (_id, input) => fakeAppointment(input)),
      move: vi.fn(async (_id, slot) => ({ ...futura, ...slot })),
      scheduleOnReserve: vi.fn(async (_id, input) => fakeAppointment(input))
    },
    commitments: {
      listRange: vi.fn(async () => commitments),
      create: vi.fn(async (input) => commitment(input)),
      update: vi.fn(async (_id, input) => commitment(input)),
      remove: vi.fn(async () => undefined)
    },
    patients: { list: vi.fn(async () => [fakePatient()]) },
    attendance: { listByPatient: vi.fn(async () => []) },
    waitlist: { list: vi.fn(async () => [espera]) },
    encaixe: {
      sugerir: vi.fn(async () => [
        {
          inicio: '2026-10-16T14:00',
          fim: '2026-10-16T14:45',
          preferida: true,
          encostada: true
        },
        {
          inicio: '2026-10-15T08:00',
          fim: '2026-10-15T08:45',
          preferida: true,
          encostada: true
        }
      ]),
      quemCabe: vi.fn(async () => [])
    }
  }
  Object.assign(window, { api })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = (): ReturnType<typeof renderRoute> => renderRoute('/agenda', '/agenda', <AgendaPage />)

describe('compromissos na agenda', () => {
  it('aparecem como bloqueio, só com o tipo e o título', async () => {
    setup([], [hospital])
    open()
    const block = (await screen.findByText('Hospital')).closest<HTMLElement>('.rbc-event')!
    expect(block.classList.contains('event-block')).toBe(true)
    expect(within(block).getByText(/Hospital Fictício/)).toBeTruthy()
    expect(block.getAttribute('title')).toContain('14:00 – 15:00 · Hospital: Hospital Fictício')
  })

  it('o horário novo escolhe entre paciente e compromisso', async () => {
    setup()
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Novo agendamento' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo agendamento' })
    const tipo = within(dialog).getByRole('group', { name: 'O que marcar' })
    await user.click(within(tipo).getByRole('button', { name: 'Compromisso' }))
    const novo = await screen.findByRole('dialog', { name: 'Novo compromisso' })
    await user.click(within(novo).getByRole('button', { name: 'Palestra' }))
    await user.type(within(novo).getByRole('textbox', { name: /Título/ }), 'Escola Fictícia')
    expect(within(novo).getByText(/Palestra de 30 min na quarta-feira, 14 de outubro/)).toBeTruthy()
    await user.click(within(novo).getByRole('button', { name: 'Bloquear horário' }))
    await waitFor(() =>
      expect(api.commitments.create).toHaveBeenCalledWith({
        tipo: 'palestra',
        titulo: 'Escola Fictícia',
        inicio: '2026-10-14T10:30',
        fim: '2026-10-14T11:00',
        observacao: ''
      })
    )
  })

  it('a reserva vira agendamento de paciente no mesmo horário', async () => {
    setup([], [reserva])
    open()
    const user = userEvent.setup()
    await user.click((await screen.findByText('Reserva')).closest<HTMLElement>('.rbc-event')!)
    const dialog = await screen.findByRole('dialog', { name: 'Compromisso' })
    await user.click(within(dialog).getByRole('button', { name: 'Agendar paciente' }))
    const novo = await screen.findByRole('dialog', { name: 'Novo agendamento' })
    await user.click(within(novo).getByRole('combobox', { name: /Paciente/ }))
    await user.click(await screen.findByRole('option', { name: /Helena Fictícia Andrade/ }))
    await user.click(within(novo).getByRole('button', { name: 'Agendar' }))
    await waitFor(() =>
      expect(api.appointments.scheduleOnReserve).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          patient_id: 1,
          inicio: '2026-10-16T09:00',
          fim: '2026-10-16T10:00'
        })
      )
    )
    expect(api.appointments.create).not.toHaveBeenCalled()
  })
})

describe('painel da lista de espera na semana', () => {
  it('fica ao lado da semana e recolhe', async () => {
    setup()
    open()
    const painel = await screen.findByRole('complementary', { name: 'Encaixe' })
    expect(await within(painel).findByText('Caio Fictício Prado')).toBeTruthy()
    expect(within(painel).getByText(/Clique num horário vago/)).toBeTruthy()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Lista de espera' }))
    expect(screen.queryByRole('complementary', { name: 'Encaixe' })).toBeNull()
    expect(localStorage.getItem('auri.agenda.listaDeEspera')).toBe('fechado')
  })

  it('escolher um horário de quem espera abre o agendamento preenchido', async () => {
    setup()
    open()
    const user = userEvent.setup()
    const painel = await screen.findByRole('complementary', { name: 'Encaixe' })
    await user.click(await within(painel).findByRole('button', { name: 'Horários livres' }))
    await user.click(await within(painel).findByRole('button', { name: /qui, 15 de out · 08:00/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo agendamento' })
    expect(within(dialog).getByText('Caio Fictício Prado')).toBeTruthy()
    expect(
      within(dialog).getByText(/Sessão de 45 min com Caio Fictício Prado na quinta-feira/)
    ).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Agendar' }))
    await waitFor(() =>
      expect(api.appointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 3,
          inicio: '2026-10-15T08:00',
          fim: '2026-10-15T08:45'
        })
      )
    )
  })

  it('não aparece na visão Mês', async () => {
    setup()
    open()
    await screen.findByRole('complementary', { name: 'Encaixe' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mês' }))
    expect(screen.queryByRole('complementary', { name: 'Encaixe' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lista de espera' })).toBeNull()
  })
})

describe('remarcar', () => {
  it('sugere horários livres e move a sessão para o escolhido', async () => {
    setup([futura])
    open()
    const user = userEvent.setup()
    await user.click(
      (
        await screen.findByText('Ana Fictícia Lima', { selector: '.name-full' })
      ).closest<HTMLElement>('.rbc-event')!
    )
    const dialog = await screen.findByRole('dialog', { name: 'Editar agendamento' })
    await user.click(within(dialog).getByRole('button', { name: 'Remarcar' }))
    const remarcar = await screen.findByRole('dialog', { name: 'Remarcar' })
    expect(api.encaixe.sugerir).toHaveBeenCalledWith({
      patient_id: futura.patient_id,
      duracao: 45,
      periodos: ['manha'],
      de: '2026-10-14',
      ate: '2026-11-03',
      ignorar_appointment_id: futura.id
    })
    const opcoes = await within(remarcar).findAllByRole('radio')
    expect(opcoes.map((o) => o.textContent)).toEqual([
      'qui, 15 de out · 08:00–08:45',
      'sex, 16 de out · 14:00–14:45'
    ])
    const confirmar = within(remarcar).getByRole('button', { name: 'Remarcar' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
    await user.click(opcoes[1])
    await user.click(confirmar)
    await waitFor(() =>
      expect(api.appointments.move).toHaveBeenCalledWith(
        futura.id,
        { inicio: '2026-10-16T14:00', fim: '2026-10-16T14:45' },
        futura.updated_at
      )
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('não oferece remarcar uma sessão que já começou', async () => {
    const passada = fakeAppointment({ inicio: '2026-10-13T09:00', patient_nome: 'Bia Fictícia' })
    setup([passada])
    open()
    await userEvent
      .setup()
      .click(
        (await screen.findByText('Bia Fictícia', { selector: '.name-full' })).closest<HTMLElement>(
          '.rbc-event'
        )!
      )
    const dialog = await screen.findByRole('dialog', { name: 'Registro da sessão' })
    expect(within(dialog).queryByRole('button', { name: 'Remarcar' })).toBeNull()
  })
})
