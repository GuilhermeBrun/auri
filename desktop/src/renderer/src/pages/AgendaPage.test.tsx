// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO, type Funcionamento } from '@shared/agenda'
import type { Appointment, Clinic } from '@shared/schemas'
import type { TipoAtendimento } from '@shared/tipos'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { fakeAppointment, fakePatient, renderRoute, AVALIACAO } from '@renderer/testing'

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
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
    animate: () => ({ finished: Promise.resolve(), cancel: () => {} })
  })
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
  ...AVALIACAO
})
const sabado = fakeAppointment({ inicio: '2026-10-17T11:00', patient_nome: 'Caio Fictício' })

let api: {
  clinic: Record<string, ReturnType<typeof vi.fn>>
  appointments: Record<string, ReturnType<typeof vi.fn>>
  patients: Record<string, ReturnType<typeof vi.fn>>
  attendance: Record<string, ReturnType<typeof vi.fn>>
  tipos: Record<string, ReturnType<typeof vi.fn>>
}

const marca = (id: number, nome: string, cor: string): TipoAtendimento => ({
  id,
  nome,
  categoria: 'marca',
  cor,
  duracao: null,
  sistema: null,
  arquivado: false
})
const CONVENIO = { id: 7, nome: 'Convênio', cor: '#db2777' } as const
const TIPOS: TipoAtendimento[] = [
  {
    id: 1,
    nome: 'Sessão',
    categoria: 'sessao',
    cor: '#6b7280',
    duracao: 30,
    sistema: null,
    arquivado: false
  },
  {
    id: 2,
    nome: 'Avaliação',
    categoria: 'avaliacao',
    cor: '#2563eb',
    duracao: 60,
    sistema: null,
    arquivado: false
  },
  {
    id: 4,
    nome: 'Audiometria',
    categoria: 'exame',
    cor: '#7c3aed',
    duracao: 45,
    sistema: null,
    arquivado: false
  },
  {
    id: 12,
    nome: 'Reunião',
    categoria: 'compromisso',
    cor: '#0d9488',
    duracao: 60,
    sistema: null,
    arquivado: false
  },
  marca(CONVENIO.id, CONVENIO.nome, CONVENIO.cor),
  marca(8, 'Primeira vez', '#d97706')
]

function setup(appointments: Appointment[], funcionamento = FUNCIONAMENTO_PADRAO): void {
  api = {
    clinic: { get: vi.fn(async () => clinicWith(funcionamento)) },
    appointments: {
      listRange: vi.fn(async () => appointments),
      create: vi.fn(async (input) => fakeAppointment(input)),
      update: vi.fn(async (_id, input) => fakeAppointment(input))
    },
    patients: { list: vi.fn(async () => [fakePatient()]) },
    attendance: { listByPatient: vi.fn(async () => []) },
    tipos: { list: vi.fn(async () => TIPOS) }
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

  it('deixa arrastar só a sessão que ainda vai acontecer e sem chegada assinada', async () => {
    const futura = fakeAppointment({ inicio: '2026-10-15T09:00', patient_nome: 'Iara Fictícia' })
    const passada = fakeAppointment({ inicio: '2026-10-13T09:00', patient_nome: 'João Fictício' })
    const assinada = fakeAppointment({
      inicio: '2026-10-14T11:00',
      patient_nome: 'Lia Fictícia',
      assinatura: { id: 1, signer_nome: 'Mãe', signer_parentesco: 'Mãe', assinado_em: 'x' }
    })
    setup([futura, passada, assinada])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    const alca = (event: HTMLElement): Element | null =>
      event.querySelector('.rbc-addons-dnd-resize-ns-anchor')
    expect(alca(await eventOf('Iara Fictícia'))).toBeTruthy()
    expect(alca(await eventOf('João Fictício'))).toBeNull()
    expect(alca(await eventOf('Lia Fictícia'))).toBeNull()
  })

  it('marca quem aguarda resposta da confirmação e quem ficou sem resposta', async () => {
    const prazo = new Date(2026, 9, 14, 12, 0).toISOString()
    const aguarda = fakeAppointment({
      inicio: '2026-10-15T09:00',
      patient_nome: 'Gabi Fictícia',
      pedido: { estado: 'aguardando', prazo }
    })
    const livre = fakeAppointment({
      inicio: '2026-10-15T11:00',
      patient_nome: 'Hugo Fictício',
      presenca: 'desmarcou',
      pedido: { estado: 'sem_resposta', prazo }
    })
    setup([aguarda, livre])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    expect(
      within(await eventOf('Gabi Fictícia')).getByLabelText('Aguardando resposta até 12:00')
    ).toBeTruthy()
    expect(
      within(await eventOf('Hugo Fictício')).getByLabelText('Sem resposta, horário liberado')
    ).toBeTruthy()
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

describe('tipos e etiquetas na agenda', () => {
  const exame = fakeAppointment({
    inicio: '2026-10-15T09:00',
    patient_nome: 'Eva Fictícia',
    tipo_id: 4,
    tipo_nome: 'Audiometria',
    tipo_cor: '#7c3aed',
    categoria: 'exame',
    etiquetas: [CONVENIO]
  })
  const comum = fakeAppointment({ inicio: '2026-10-16T09:00', patient_nome: 'Fábio Fictício' })

  it('o cartão mostra o nome do tipo, a cor e as etiquetas', async () => {
    setup([exame, comum])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    const card = await eventOf('Eva Fictícia')
    expect(within(card).getByText(/Audiometria/)).toBeTruthy()
    expect(within(card).getByRole('img', { name: 'Etiquetas: Convênio' })).toBeTruthy()
    const wrapper = card.closest<HTMLElement>('.rbc-event') ?? card
    expect(wrapper.style.getPropertyValue('--tipo-cor')).toBe('#7c3aed')
  })

  it('filtra a agenda por marca e por etiqueta principal', async () => {
    setup([exame, comum])
    renderRoute('/agenda', '/agenda', <AgendaPage />)
    await eventOf('Fábio Fictício')
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por etiqueta' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Convênio' }))
    await waitFor(() =>
      expect(screen.queryByText('Fábio Fictício', { selector: '.name-full' })).toBeNull()
    )
    expect(await eventOf('Eva Fictícia')).toBeTruthy()
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por etiqueta' }))
    expect(screen.queryByRole('option', { name: 'Reunião' })).toBeNull()
    await userEvent.click(await screen.findByRole('option', { name: 'Sessão' }))
    expect(await eventOf('Fábio Fictício')).toBeTruthy()
    await waitFor(() =>
      expect(screen.queryByText('Eva Fictícia', { selector: '.name-full' })).toBeNull()
    )
  })

  it('o diálogo usa a duração do tipo e grava tipo e etiquetas', async () => {
    setup([])
    renderRoute(
      '/agenda',
      '/agenda',
      <AppointmentDialog draft={draftAt(new Date(2026, 9, 15, 9, 0))} onClose={() => {}} />
    )
    const tipo = await screen.findByRole('combobox', { name: 'Etiqueta' })
    await waitFor(() => expect(tipo.textContent).toContain('Sessão'))
    await userEvent.click(tipo)
    await userEvent.click(await screen.findByRole('option', { name: 'Audiometria' }))
    expect(screen.getByRole('combobox', { name: 'Duração' }).textContent).toContain('45 min')
    await userEvent.click(screen.getByRole('button', { name: 'Primeira vez' }))
    expect(screen.getByText(/Audiometria de 45 min/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }))
    await waitFor(() =>
      expect(api.appointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_id: 4,
          etiquetas: [8],
          inicio: '2026-10-15T09:00',
          fim: '2026-10-15T09:45'
        })
      )
    )
  })
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
        amanha.updated_at,
        'Este computador'
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

describe('arrastar o cartão pela agenda', () => {
  const TOPO = 50
  const ALTURA = 13 * 60
  const LARGURA = 100
  const nina = fakeAppointment({ inicio: '2026-10-15T09:00', patient_nome: 'Nina Fictícia' })

  const caixa = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({})
    }) as DOMRect

  function geometria(this: Element): DOMRect {
    if (this.classList.contains('rbc-time-view')) return caixa(0, 0, 800, 900)
    if (this.classList.contains('rbc-time-content')) return caixa(0, TOPO, 800, 600)
    const coluna = this.closest<HTMLElement>('.rbc-time-content > .rbc-day-slot')
    if (!coluna) return caixa(0, 0, 0, 0)
    const colunas = Array.from(coluna.parentElement!.querySelectorAll(':scope > .rbc-day-slot'))
    const esquerda = 52 + (colunas.indexOf(coluna) - 1) * LARGURA
    const largura = coluna.classList.contains('day-hidden') ? 0 : LARGURA
    if (this === coluna) return caixa(esquerda, TOPO, largura, ALTURA)
    if (this.classList.contains('rbc-events-container')) {
      return caixa(esquerda, TOPO, largura - 4, ALTURA)
    }
    const { top, height } = (this as HTMLElement).style
    const em = (valor: string): number => (parseFloat(valor) / 100) * ALTURA
    return caixa(esquerda, TOPO + em(top), largura - 4, em(height))
  }

  const ponteiro = (clientX: number, clientY: number): PointerEventInit => ({
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX,
    clientY
  })

  const marca = (): HTMLElement | null => document.querySelector<HTMLElement>('.agenda-destino')
  const horario = (): string | null | undefined =>
    document.querySelector<HTMLElement>('.agenda-fantasma-horario')?.textContent
  const fantasma = (): HTMLElement | null => document.querySelector<HTMLElement>('.agenda-fantasma')

  async function pegar(): Promise<HTMLElement> {
    setup([nina])
    api.appointments.move = vi.fn(async (id: number, slot: { inicio: string; fim: string }) =>
      fakeAppointment({ ...nina, id, ...slot })
    )
    renderRoute('/agenda', '/agenda', <AgendaPage />, toast)
    const cartao = await eventOf('Nina Fictícia')
    await waitFor(() => expect(shownHeaders()).toHaveLength(6))
    fireEvent.pointerDown(cartao, ponteiro(372, 180))
    return cartao
  }

  const toast = vi.fn()

  beforeEach(() => {
    toast.mockClear()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(geometria)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('desgruda, segue o ponteiro livre e remarca no horário marcado na grade', async () => {
    await pegar()
    fireEvent.pointerMove(window, ponteiro(375, 183))
    await new Promise((pronto) => requestAnimationFrame(pronto))
    expect(fantasma()).toBeNull()

    fireEvent.pointerMove(window, ponteiro(472, 280))
    await waitFor(() => expect(marca()?.hidden).toBe(false))
    expect(horario()).toBe('10:45 – 11:15')
    expect(fantasma()?.querySelector('[data-horario]')?.textContent).toBe('10:45 – 11:15')
    expect(fantasma()?.style.transform).toMatch(/^translate3d\(452px, 270px/)
    await waitFor(() =>
      expect(document.querySelector('.rbc-time-content .event-origem')?.textContent).toContain(
        'Nina Fictícia'
      )
    )

    fireEvent.pointerMove(window, ponteiro(473, 281))
    await waitFor(() => expect(fantasma()?.style.transform).toMatch(/^translate3d\(453px, 271px/))
    expect(horario()).toBe('10:45 – 11:15')

    fireEvent.pointerUp(window, ponteiro(473, 281))
    await waitFor(() =>
      expect(api.appointments.move).toHaveBeenCalledWith(
        nina.id,
        { inicio: '2026-10-16T10:45', fim: '2026-10-16T11:15' },
        nina.updated_at,
        'Este computador'
      )
    )
    await waitFor(() => expect(fantasma()).toBeNull())
    expect(marca()).toBeNull()
    expect(document.documentElement.dataset.arrastando).toBeUndefined()
  })

  it('Esc devolve o cartão ao lugar sem gravar', async () => {
    await pegar()
    fireEvent.pointerMove(window, ponteiro(472, 280))
    await waitFor(() => expect(marca()?.hidden).toBe(false))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(fantasma()).toBeNull())
    expect(marca()).toBeNull()
    fireEvent.pointerUp(window, ponteiro(472, 280))
    await waitFor(async () =>
      expect((await eventOf('Nina Fictícia')).classList).not.toContain('event-origem')
    )
    expect(api.appointments.move).not.toHaveBeenCalled()
    expect(api.appointments.update).not.toHaveBeenCalled()
  })

  it('soltar fora da grade volta para o lugar', async () => {
    await pegar()
    fireEvent.pointerMove(window, ponteiro(20, 280))
    await waitFor(() => expect(fantasma()?.style.transform).toMatch(/^translate3d\(0px, 270px/))
    expect(marca()?.hidden).toBe(true)
    fireEvent.pointerUp(window, ponteiro(20, 280))
    await waitFor(() => expect(fantasma()).toBeNull())
    expect(api.appointments.move).not.toHaveBeenCalled()
  })

  it('marca o horário recusado e avisa ao soltar ali', async () => {
    await pegar()
    fireEvent.pointerMove(window, ponteiro(572, 520))
    await waitFor(() => expect(horario()).toBe('14:45 – 15:15'))
    expect(marca()?.classList).toContain('recusado')
    fireEvent.pointerUp(window, ponteiro(572, 520))
    await waitFor(() => expect(fantasma()).toBeNull())
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fora do horário de funcionamento' })
    )
    expect(api.appointments.move).not.toHaveBeenCalled()
  })
})
