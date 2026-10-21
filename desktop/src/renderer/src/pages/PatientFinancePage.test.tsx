// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { PatientFinance } from '@shared/finance'
import { fakePatient, renderRoute } from '@renderer/testing'
import type { ToastInput } from '@renderer/lib/toast'

vi.hoisted(() => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {}
  })
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

import { PatientFinanceRoute } from './PatientFinancePage'

const patient = fakePatient()

const estorno = null

const finance: PatientFinance = {
  patient_id: 1,
  billing: {
    forma: 'pacote',
    service_id: 1,
    insurer_id: null,
    plan_id: 3,
    carteirinha: '',
    desde: '2026-10-01',
    updated_at: '2026-10-01T12:00:00.000Z',
    service: { nome: 'Sessão', valor_centavos: 19000 },
    insurer: null,
    plan: { nome: '8 sessões', sessoes: 8, valor_centavos: 152000 }
  },
  saldo_centavos: 38000,
  convenios: [],
  packages: [
    {
      id: 4,
      nome: '8 sessões',
      sessoes: 8,
      usadas: 3,
      valor_centavos: 152000,
      inicio: '2026-10-01',
      validade: '2026-11-29',
      em_vigor: true,
      estorno
    }
  ],
  charges: [
    {
      id: 10,
      data: '2026-10-01',
      descricao: 'Pacote 8 sessões · 8 sessões',
      valor_centavos: 152000,
      motivo: 'pacote',
      appointment_id: null,
      package_id: 4,
      insurer_id: null,
      insurer_nome: null,
      computador: 'Recepção',
      created_at: '2026-10-01T12:00:00.000Z',
      estorno,
      situacao: 'parcial',
      pago_centavos: 114000
    }
  ],
  payments: [
    {
      id: 20,
      data: '2026-10-02',
      valor_centavos: 114000,
      forma: 'pix',
      insurer_id: null,
      insurer_nome: null,
      observacao: '',
      computador: 'Recepção',
      created_at: '2026-10-02T12:00:00.000Z',
      estorno
    },
    {
      id: 21,
      data: '2026-10-03',
      valor_centavos: 5000,
      forma: 'dinheiro',
      insurer_id: null,
      insurer_nome: null,
      observacao: '',
      computador: 'Recepção',
      created_at: '2026-10-03T12:00:00.000Z',
      estorno: {
        em: '2026-10-03T13:00:00.000Z',
        motivo: 'Lançado em dobro',
        computador: 'Recepção'
      }
    }
  ],
  uses: [
    {
      id: 30,
      package_id: 4,
      package_nome: '8 sessões',
      appointment_id: 50,
      inicio: '2026-10-06T14:00',
      numero: 1,
      sessoes: 8,
      computador: 'Recepção',
      created_at: '2026-10-06T15:00:00.000Z',
      estorno
    }
  ],
  pendentes: [
    { appointment_id: 60, inicio: '2026-10-09T14:00', tipo_nome: 'Sessão', categoria: 'sessao' },
    { appointment_id: 61, inicio: '2026-10-13T14:00', tipo_nome: 'Sessão', categoria: 'sessao' }
  ],
  renovacao: null
}

const catalog = {
  services: [{ id: 1, nome: 'Sessão', valor_centavos: 19000, arquivado: false }],
  plans: [
    {
      id: 3,
      nome: '8 sessões',
      sessoes: 8,
      valor_centavos: 152000,
      validade_dias: 60,
      arquivado: false
    }
  ],
  insurers: []
}

let api: { patients: Record<string, unknown>; finance: Record<string, ReturnType<typeof vi.fn>> }

beforeEach(() => {
  api = {
    patients: { get: vi.fn(async () => patient), list: vi.fn(async () => [patient]) },
    finance: {
      patient: vi.fn(async () => finance),
      catalog: vi.fn(async () => ({ services: [], plans: [], insurers: [] })),
      pay: vi.fn(async () => 22),
      void: vi.fn(async () => 1),
      launchSession: vi.fn(async () => ({ kind: 'use', id: 31 })),
      setBilling: vi.fn(async () => finance.billing),
      contractPackage: vi.fn(async () => 5),
      renewPackage: vi.fn(async () => 5)
    }
  }
  Object.assign(window, { api })
})

afterEach(cleanup)

function renderPage(toast: (input: ToastInput) => void = () => {}) {
  return renderRoute(
    '/pacientes/1/financeiro',
    '/pacientes/:id/financeiro',
    <PatientFinanceRoute />,
    toast
  )
}

describe('aba Financeiro da ficha', () => {
  it('mostra saldo, pacote com a contagem e o extrato com o estorno riscado', async () => {
    renderPage()
    expect(await screen.findByText('Em aberto')).toBeTruthy()
    expect(screen.getByText('R$ 380,00')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Financeiro' }).getAttribute('aria-current')).toBe(
      'page'
    )
    expect(screen.getByText('· 3 de 8 usadas · restam 5')).toBeTruthy()
    expect(screen.getByText('Pacote · 8 sessões')).toBeTruthy()
    expect(screen.getByRole('list', { name: '3 de 8 sessões usadas' })).toBeTruthy()
    expect(screen.getByText(/vale até 29\/11\/2026/)).toBeTruthy()
    expect(screen.getByText('Parcial · falta R$ 380,00')).toBeTruthy()
    expect(screen.getByText('1/8 do pacote 8 sessões')).toBeTruthy()
    expect(screen.getByText('Estornado em 03/10/2026: Lançado em dobro')).toBeTruthy()
    expect(screen.getByText('−R$ 1.140,00')).toBeTruthy()
  })

  it('lança as sessões com presença', async () => {
    const toast = vi.fn()
    renderPage(toast)
    await userEvent.click(await screen.findByRole('button', { name: 'Lançar todas' }))
    await waitFor(() => expect(api.finance.launchSession).toHaveBeenCalledTimes(2))
    expect(api.finance.launchSession).toHaveBeenNthCalledWith(1, 60, 'Este computador')
    expect(api.finance.launchSession).toHaveBeenNthCalledWith(2, 61, 'Este computador')
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '2 sessões lançadas' }))
    )
  })

  it('registra um pagamento já com o valor em aberto', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pagamento' }))
    const dialog = await screen.findByRole('dialog')
    const valor = within(dialog).getByLabelText(/Valor/) as HTMLInputElement
    await waitFor(() => expect(valor.value).toBe('380,00'))
    await userEvent.clear(valor)
    await userEvent.type(valor, '19000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dinheiro' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))
    await waitFor(() =>
      expect(api.finance.pay).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ valor_centavos: 19000, forma: 'dinheiro', insurer_id: null }),
        'Este computador'
      )
    )
  })

  it('estorno pede o motivo', async () => {
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Estornar Pagamento · Pix · −R$ 1.140,00' })
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }))
    expect(within(dialog).getByText('Diga por que está estornando')).toBeTruthy()
    expect(api.finance.void).not.toHaveBeenCalled()
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Pix devolvido')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }))
    await waitFor(() =>
      expect(api.finance.void).toHaveBeenCalledWith(
        'payment',
        20,
        'Pix devolvido',
        'Este computador'
      )
    )
  })

  it('estornar a cobrança do pacote estorna o pacote', async () => {
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Estornar Pacote 8 sessões · 8 sessões · R$ 1.520,00'
      })
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Desistiu')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }))
    await waitFor(() =>
      expect(api.finance.void).toHaveBeenCalledWith('package', 4, 'Desistiu', 'Este computador')
    )
  })

  it('pacote acabado avisa e renova com um clique', async () => {
    const toast = vi.fn()
    api.finance.patient.mockResolvedValue({
      ...finance,
      packages: [{ ...finance.packages[0], usadas: 8, em_vigor: false }],
      renovacao: {
        plan_id: 3,
        nome: '8 sessões',
        valor_centavos: 152000,
        situacao: 'acabou',
        restantes: 0
      }
    })
    renderPage(toast)
    expect(await screen.findByText('O pacote acabou')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Renovar' }))
    await waitFor(() => expect(api.finance.renewPackage).toHaveBeenCalledWith(1, 'Este computador'))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pacote renovado' }))
    )
  })

  it('Cobrar mostra os pacotes e contrata o escolhido', async () => {
    api.finance.catalog.mockResolvedValue(catalog)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Cobrar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByLabelText('Serviço ou pacote'))
    await userEvent.click(
      await screen.findByRole('option', { name: 'Pacote 8 sessões · R$ 1.520,00' })
    )
    expect(within(dialog).queryByText('Descrição')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Contratar' }))
    await waitFor(() =>
      expect(api.finance.contractPackage).toHaveBeenCalledWith(
        1,
        { plan_id: 3, inicio: expect.any(String) },
        'Este computador'
      )
    )
  })

  it('forma de cobrança por pacote escolhe o pacote e contrata ao salvar', async () => {
    api.finance.catalog.mockResolvedValue(catalog)
    api.finance.patient.mockResolvedValue({
      ...finance,
      billing: null,
      packages: [],
      pendentes: []
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Definir forma de cobrança' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pacote' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar e contratar' }))
    expect(await within(dialog).findByText('Escolha o pacote')).toBeTruthy()
    await userEvent.click(within(dialog).getByLabelText('Pacote'))
    await userEvent.click(await screen.findByRole('option', { name: '8 sessões · R$ 1.520,00' }))
    await userEvent.click(within(dialog).getByLabelText('Sessão fora do pacote'))
    await userEvent.click(await screen.findByRole('option', { name: 'Sessão · R$ 190,00' }))
    expect(within(dialog).getByRole('switch', { name: 'Contratar agora' })).toBeTruthy()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar e contratar' }))
    await waitFor(() =>
      expect(api.finance.setBilling).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ forma: 'pacote', plan_id: 3, service_id: 1 }),
        undefined,
        { inicio: expect.any(String), computador: 'Este computador' }
      )
    )
  })

  it('sem forma de cobrança convida a definir', async () => {
    api.finance.patient.mockResolvedValue({ ...finance, billing: null, pendentes: [] })
    renderPage()
    expect(await screen.findByText('Defina a forma de cobrança')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Definir forma de cobrança' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Nenhum valor cadastrado')).toBeTruthy()
  })
})
