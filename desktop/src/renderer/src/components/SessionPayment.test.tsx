// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ChargeEntry, PatientFinance } from '@shared/finance'
import { fakeAppointment, renderRoute } from '@renderer/testing'

vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  Object.assign(window, { platform: 'darwin', backup: bridge(), connection: bridge() })
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }
})

import { SessionPayment } from './SessionPayment'

const presente = fakeAppointment({ id: 50, inicio: '2026-10-14T14:00', presenca: 'presente' })
const falta = fakeAppointment({ id: 51, inicio: '2026-10-15T14:00', presenca: 'falta' })

const billing: PatientFinance['billing'] = {
  forma: 'particular',
  service_id: 1,
  insurer_id: null,
  carteirinha: '',
  desde: '2026-10-01',
  updated_at: '2026-10-01T12:00:00.000Z',
  service: { nome: 'Sessão', valor_centavos: 19000 },
  insurer: null
}

const charge = (over: Partial<ChargeEntry>): ChargeEntry => ({
  id: 10,
  data: '2026-10-14',
  descricao: 'Sessão de 14/10',
  valor_centavos: 19000,
  motivo: 'sessao',
  appointment_id: 50,
  package_id: null,
  insurer_id: null,
  insurer_nome: null,
  computador: 'Recepção',
  created_at: '2026-10-14T17:00:00.000Z',
  estorno: null,
  situacao: 'em_aberto',
  pago_centavos: 0,
  ...over
})

const base: PatientFinance = {
  patient_id: 1,
  billing,
  saldo_centavos: 19000,
  convenios: [],
  packages: [],
  charges: [],
  payments: [],
  uses: [],
  pendentes: []
}

let finance: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  finance = {
    patient: vi.fn(async () => ({ ...base, charges: [charge({})] })),
    chargeAbsence: vi.fn(async () => 11),
    pay: vi.fn(async () => 1)
  }
  Object.assign(window, { api: { finance, patients: { list: vi.fn(async () => []) } } })
})

afterEach(cleanup)

function show(appointment = presente, onLeave = vi.fn()) {
  renderRoute('/agenda', '/agenda', <SessionPayment appointment={appointment} onLeave={onLeave} />)
  return onLeave
}

describe('pagamento no registro da sessão', () => {
  it('sessão cobrada em aberto: valor, situação e registrar pagamento', async () => {
    show()
    expect(await screen.findByText('R$ 190,00 · em aberto')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Helena Fictícia Andrade')).toBeTruthy()
  })

  it('pacote mostra a contagem e não oferece pagamento', async () => {
    finance.patient.mockResolvedValue({
      ...base,
      uses: [
        {
          id: 30,
          package_id: 4,
          package_nome: '8 sessões',
          appointment_id: 50,
          inicio: presente.inicio,
          numero: 3,
          sessoes: 8,
          computador: 'Recepção',
          created_at: '2026-10-14T17:00:00.000Z',
          estorno: null
        }
      ]
    })
    show()
    expect(await screen.findByText('8 sessões · sessão 3 de 8')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
  })

  it('convênio diz quem paga', async () => {
    finance.patient.mockResolvedValue({
      ...base,
      charges: [charge({ insurer_id: 5, insurer_nome: 'Saúde Fictícia', valor_centavos: 9500 })]
    })
    show()
    expect(
      await screen.findByText('Saúde Fictícia · R$ 95,00 · a receber do convênio')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
  })

  it('falta: cobrar a sessão pede confirmação', async () => {
    finance.patient.mockResolvedValue(base)
    show(falta)
    expect(await screen.findByText('Falta não cobrada.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar sessão' }))
    expect(screen.getByText('Cobrar R$ 190,00?')).toBeTruthy()
    expect(finance.chargeAbsence).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }))
    await waitFor(() => expect(finance.chargeAbsence).toHaveBeenCalledWith(51, 'Este computador'))
  })

  it('sem forma de cobrança leva ao financeiro do paciente', async () => {
    finance.patient.mockResolvedValue({ ...base, billing: null })
    const onLeave = show(falta)
    expect(await screen.findByText('Paciente sem forma de cobrança.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cobrar sessão' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir financeiro' }))
    expect(onLeave).toHaveBeenCalled()
    expect(await screen.findByText('Outra tela')).toBeTruthy()
  })

  it('sessão sem registro de presença não mostra nada', async () => {
    const { container } = renderRoute(
      '/agenda',
      '/agenda',
      <SessionPayment appointment={{ ...presente, presenca: '' }} onLeave={() => {}} />
    )
    await waitFor(() => expect(finance.patient).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
