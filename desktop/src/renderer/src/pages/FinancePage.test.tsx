// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FinanceCatalog, FinanceOverview } from '@shared/finance'
import { renderRoute } from '@renderer/testing'

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

import { FinanceCatalogPage } from './FinanceCatalogPage'
import { FinancePage } from './FinancePage'

const catalog: FinanceCatalog = {
  services: [
    { id: 1, nome: 'Sessão', valor_centavos: 19000, arquivado: false },
    { id: 2, nome: 'Avaliação antiga', valor_centavos: 35000, arquivado: true }
  ],
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

const overview: FinanceOverview = {
  de: '2026-10-01',
  ate: '2026-10-31',
  abertos: [
    { patient_id: 7, nome: 'Bruno Fictício', saldo_centavos: 38000, desde: '2026-10-02' },
    { patient_id: 8, nome: 'Helena Fictícia', saldo_centavos: 19000, desde: '2026-10-09' }
  ],
  renovar: [
    {
      patient_id: 9,
      patient_nome: 'Lia Fictícia',
      plan_id: 3,
      nome: '8 sessões',
      valor_centavos: 152000,
      situacao: 'acabou',
      restantes: 0
    }
  ],
  convenios: [{ insurer_id: 5, nome: 'Saúde Fictícia', saldo_centavos: 9500 }],
  recebimentos: [
    {
      id: 1,
      patient_id: 8,
      patient_nome: 'Helena Fictícia',
      data: '2026-10-10',
      valor_centavos: 19000,
      forma: 'pix',
      insurer_id: null,
      insurer_nome: null,
      observacao: 'Mãe pagou',
      computador: 'Recepção',
      created_at: '2026-10-10T12:00:00.000Z',
      estorno: null
    }
  ],
  total_centavos: 19000,
  por_forma: { pix: 19000, dinheiro: 0, cartao: 0, transferencia: 0 }
}

let finance: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
  finance = {
    overview: vi.fn(async () => overview),
    catalog: vi.fn(async () => catalog),
    renewPackage: vi.fn(async () => 12),
    savePlan: vi.fn(async (_id, input) => ({ id: 9, ...input, arquivado: false })),
    archiveService: vi.fn(async () => ({ ...catalog.services[1], arquivado: false }))
  }
  Object.assign(window, { api: { finance, patients: { list: vi.fn(async () => []) } } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('tela Financeiro', () => {
  it('em aberto por paciente, convênios e recebimentos do mês', async () => {
    renderRoute('/financeiro', '/financeiro', <FinancePage />)
    expect(await screen.findByText('Recebido em outubro de 2026')).toBeTruthy()
    expect(finance.overview).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
    expect(screen.getByText('Pix R$ 190,00')).toBeTruthy()
    const aberto = screen.getByRole('region', { name: 'Em aberto' })
    expect(within(aberto).getByText('R$ 570,00')).toBeTruthy()
    expect(
      within(aberto)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['BFBruno Fictíciodesde 02/10R$ 380,00', 'HFHelena Fictíciadesde 09/10R$ 190,00'])
    expect(screen.getByText('Saúde Fictícia')).toBeTruthy()
    expect(screen.getByText('Pix · Mãe pagou')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await waitFor(() => expect(finance.overview).toHaveBeenCalledWith('2026-09-01', '2026-09-30'))
  })

  it('pacotes a renovar com um clique', async () => {
    renderRoute('/financeiro', '/financeiro', <FinancePage />)
    const renovar = await screen.findByRole('region', { name: 'Pacotes a renovar' })
    expect(within(renovar).getByText('8 sessões · Acabou')).toBeTruthy()
    await userEvent.click(within(renovar).getByRole('button', { name: 'Renovar' }))
    await waitFor(() => expect(finance.renewPackage).toHaveBeenCalledWith(9, 'Este computador'))
  })

  it('o clique no paciente abre a aba Financeiro dele', async () => {
    renderRoute('/financeiro', '/financeiro', <FinancePage />)
    await userEvent.click(await screen.findByRole('button', { name: /Bruno Fictício/ }))
    expect(await screen.findByText('Outra tela')).toBeTruthy()
  })

  it('primeiro uso convida a cadastrar os valores', async () => {
    finance.catalog.mockResolvedValue({ services: [], plans: [], insurers: [] })
    finance.overview.mockResolvedValue({
      ...overview,
      abertos: [],
      convenios: [],
      recebimentos: [],
      total_centavos: 0
    })
    renderRoute('/financeiro', '/financeiro', <FinancePage />)
    expect(await screen.findByText('Comece pelos valores')).toBeTruthy()
  })
})

describe('Valores e convênios', () => {
  it('lista com o arquivado e cria um pacote', async () => {
    renderRoute('/financeiro/valores', '/financeiro/valores', <FinanceCatalogPage />)
    expect(await screen.findByText('R$ 190,00')).toBeTruthy()
    expect(screen.getByText('Arquivado · R$ 350,00')).toBeTruthy()
    expect(screen.getByText('8 sessões por R$ 1.520,00 · vale 60 dias')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Novo pacote' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(within(dialog).getByText('Dê um nome ao pacote')).toBeTruthy()
    expect(finance.savePlan).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText('Nome'), '10 sessões')
    await userEvent.type(within(dialog).getByLabelText(/Valor do pacote/), '180000')
    await userEvent.type(within(dialog).getByLabelText('Sessões'), '10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(finance.savePlan).toHaveBeenCalledWith(null, {
        nome: '10 sessões',
        sessoes: 10,
        valor_centavos: 180000,
        validade_dias: null
      })
    )
  })

  it('reativa um valor arquivado', async () => {
    renderRoute('/financeiro/valores', '/financeiro/valores', <FinanceCatalogPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Avaliação antiga/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reativar' }))
    await waitFor(() => expect(finance.archiveService).toHaveBeenCalledWith(2, false))
  })
})
