// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type {
  AvisosDaConfirmacao as Avisos,
  ConfirmacaoLinha,
  ConfirmacaoLista,
  ConfirmacaoRecebida
} from '@shared/confirmacao'
import { fakeAppointment, renderRoute } from '@renderer/testing'

const { confirmacoes, terms } = vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  const confirmacoes = {
    lista: vi.fn(),
    enviar: vi.fn(),
    receber: vi.fn(),
    aplicarOutra: vi.fn(),
    avisos: vi.fn(),
    dispensar: vi.fn()
  }
  const terms = { openWhatsApp: vi.fn() }
  Object.assign(window, {
    platform: 'darwin',
    api: { confirmacoes, terms },
    backup: bridge(),
    connection: bridge(),
    prefs: bridge()
  })
  return { confirmacoes, terms }
})

import { abrirResposta, aoPedirEncaixe, fecharResposta } from '@renderer/lib/confirmacoes'
import { AvisosDaConfirmacao } from './AvisosDaConfirmacao'
import { ConfirmacaoDaSessao } from './ConfirmacaoDaSessao'
import { ConfirmacoesDialog } from './ConfirmacoesDialog'
import { ReceberConfirmacao } from './ReceberConfirmacao'

const PRAZO = new Date(2026, 9, 19, 10, 30).toISOString()

function linha(over: Partial<ConfirmacaoLinha>): ConfirmacaoLinha {
  return {
    appointment_id: 1,
    inicio: '2026-10-20T09:00',
    fim: '2026-10-20T09:30',
    patient_id: 1,
    patient_nome: 'Ana Beatriz Fictícia',
    tipo_nome: 'Sessão',
    contato: { nome: 'Maria Fictícia', parentesco: 'Mãe', celular: '(65) 98888-1111' },
    confirmado: false,
    pedido: null,
    ...over
  }
}

const lista = (over: Partial<ConfirmacaoLista> = {}): ConfirmacaoLista => ({
  dia: '2026-10-20',
  janela: { aberta: true, ate: '18:00' },
  sessoes: [
    linha({ appointment_id: 1 }),
    linha({
      appointment_id: 2,
      inicio: '2026-10-20T10:00',
      patient_nome: 'Bruno Fictício',
      confirmado: true
    }),
    linha({
      appointment_id: 3,
      inicio: '2026-10-20T11:00',
      patient_nome: 'Caio Fictício',
      pedido: { estado: 'aguardando', prazo: PRAZO }
    }),
    linha({
      appointment_id: 4,
      inicio: '2026-10-20T14:00',
      patient_nome: 'Duda Fictícia',
      contato: { nome: 'Rita', parentesco: 'Mãe', celular: '' }
    })
  ],
  ...over
})

beforeEach(() => {
  confirmacoes.enviar.mockResolvedValue({
    appointment_id: 1,
    link: 'https://auri.dev.br/confirmar#1.a.b',
    numero: '5565988881111',
    mensagem: 'Olá! Confirme a sessão',
    prazo: PRAZO,
    reenvio: false
  })
  terms.openWhatsApp.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  act(() => fecharResposta())
  vi.clearAllMocks()
})

describe('confirmações do próximo dia', () => {
  it('lista quem falta, quem já confirmou, quem aguarda e quem não tem celular', async () => {
    confirmacoes.lista.mockResolvedValue(lista())
    renderRoute('/', '/', <ConfirmacoesDialog open onClose={() => {}} />)
    expect(await screen.findByText('Confirmações de terça-feira, 20/10')).toBeTruthy()
    const linhas = screen.getAllByRole('listitem')
    expect(linhas).toHaveLength(4)
    expect(linhas[0].textContent).toContain('Maria (Mãe) · (65) 98888-1111')
    expect(within(linhas[1]).getByText('Confirmada')).toBeTruthy()
    expect(linhas[2].textContent).toMatch(/até \d\d:30/)
    expect(within(linhas[2]).getByLabelText('Abrir de novo no WhatsApp')).toBeTruthy()
    expect(within(linhas[3]).getByText('Sem celular')).toBeTruthy()
  })

  it('"Enviar a próxima" abre o WhatsApp com a mensagem do Auri', async () => {
    confirmacoes.lista.mockResolvedValue(lista())
    const toast = vi.fn()
    renderRoute('/', '/', <ConfirmacoesDialog open onClose={() => {}} />, toast)
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar a próxima' }))
    await waitFor(() =>
      expect(terms.openWhatsApp).toHaveBeenCalledWith('5565988881111', 'Olá! Confirme a sessão')
    )
    expect(confirmacoes.enviar).toHaveBeenCalledWith(1, expect.any(String))
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Confira o WhatsApp e toque em enviar' })
    )
  })

  it('fora da janela, explica e não deixa enviar', async () => {
    confirmacoes.lista.mockResolvedValue(
      lista({ janela: { aberta: false, motivo: 'A clínica fecha às 18:00.' } })
    )
    renderRoute('/', '/', <ConfirmacoesDialog open onClose={() => {}} />)
    expect(await screen.findByText('A clínica fecha às 18:00.')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Enviar a próxima' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})

describe('resposta que chega', () => {
  const recebida = (over: Partial<Extract<ConfirmacaoRecebida, { ok: true }>>) => ({
    ok: true as const,
    tipo: 'desmarcada' as const,
    resposta: 'desmarcada' as const,
    titulo: 'Ana Beatriz desmarcou',
    detalhe: 'O horário de terça-feira, 20/10, às 09:00 ficou livre.',
    request_id: 9,
    appointment_id: 1,
    vaga: { inicio: '2026-10-20T09:00', fim: '2026-10-20T09:30' },
    ...over
  })

  it('aplica e oferece encaixar no horário liberado', async () => {
    confirmacoes.receber.mockResolvedValue(recebida({}))
    const encaixar = vi.fn()
    const parar = aoPedirEncaixe(encaixar)
    renderRoute('/', '/', <ReceberConfirmacao />)
    act(() => abrirResposta('https://auri.dev.br/resposta#1.x.y'))
    expect(await screen.findByText('Ana Beatriz desmarcou')).toBeTruthy()
    expect(confirmacoes.receber).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Encaixar' }))
    expect(encaixar).toHaveBeenCalledWith({ inicio: '2026-10-20T09:00', fim: '2026-10-20T09:30' })
    expect(await screen.findByText('Outra tela')).toBeTruthy()
    parar()
  })

  it('outra resposta espera a secretária aplicar', async () => {
    confirmacoes.receber.mockResolvedValue(
      recebida({ tipo: 'outra', titulo: 'Ana Beatriz mandou outra resposta', vaga: null })
    )
    confirmacoes.aplicarOutra.mockResolvedValue(recebida({ titulo: 'Sessão desmarcada' }))
    renderRoute('/', '/', <ReceberConfirmacao />)
    act(() => abrirResposta('https://auri.dev.br/resposta#1.x.y'))
    await userEvent.click(await screen.findByRole('button', { name: 'Desmarcar a sessão' }))
    expect(confirmacoes.aplicarOutra).toHaveBeenCalledWith(9, expect.any(String))
    expect(await screen.findByText('Sessão desmarcada')).toBeTruthy()
  })

  it('mostra por que a resposta não mudou a agenda', async () => {
    confirmacoes.receber.mockResolvedValue({ ok: false, erro: 'Resposta depois do prazo.' })
    renderRoute('/', '/', <ReceberConfirmacao />)
    act(() => abrirResposta('x'))
    expect(await screen.findByText('Esta resposta não mudou a agenda')).toBeTruthy()
    expect(screen.getByText('Resposta depois do prazo.')).toBeTruthy()
  })

  it('"Colar resposta" pede o texto antes de aplicar', async () => {
    confirmacoes.receber.mockResolvedValue(recebida({ tipo: 'confirmada', vaga: null }))
    renderRoute('/', '/', <ReceberConfirmacao />)
    act(() => abrirResposta())
    await userEvent.type(await screen.findByRole('textbox'), 'Sessão confirmada')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() =>
      expect(confirmacoes.receber).toHaveBeenCalledWith('Sessão confirmada', expect.any(String))
    )
  })
})

describe('avisos na agenda', () => {
  it('horário liberado com encaixe e outra resposta com a ação', async () => {
    const avisos: Avisos = {
      liberados: [
        {
          request_id: 5,
          appointment_id: 1,
          patient_nome: 'Ana Beatriz Fictícia',
          inicio: '2026-10-20T09:00',
          fim: '2026-10-20T09:30',
          motivo: 'sem_resposta',
          falta_cobrada: true,
          cobranca_erro: null
        }
      ],
      outras: [
        {
          request_id: 6,
          appointment_id: 2,
          patient_nome: 'Bruno Fictício',
          inicio: '2026-10-20T10:00',
          fim: '2026-10-20T10:30',
          resposta: 'desmarcada',
          vencido: false
        }
      ]
    }
    confirmacoes.avisos.mockResolvedValue(avisos)
    confirmacoes.dispensar.mockResolvedValue(undefined)
    const encaixar = vi.fn()
    renderRoute('/', '/', <AvisosDaConfirmacao onEncaixar={encaixar} />)
    expect(
      await screen.findByText(/Ana Beatriz não respondeu à confirmação · falta cobrada/)
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Encaixar' }))
    expect(encaixar).toHaveBeenCalledWith({ inicio: '2026-10-20T09:00', fim: '2026-10-20T09:30' })
    expect(screen.getByText('Bruno Fictício mandou outra resposta')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Dispensar o aviso de Ana Beatriz' }))
    expect(confirmacoes.dispensar).toHaveBeenCalledWith(5, 'liberado')
  })
})

describe('confirmação avulsa no registro da sessão', () => {
  it('pede a confirmação e passa a mostrar o prazo', async () => {
    const sessao = fakeAppointment({ inicio: '2026-10-20T09:00' })
    renderRoute('/', '/', <ConfirmacaoDaSessao appointment={sessao} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pedir confirmação' }))
    expect(await screen.findByText('Aguardando resposta')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeTruthy()
  })

  it('não aparece numa sessão já confirmada à mão', () => {
    const sessao = fakeAppointment({
      inicio: '2026-10-20T09:00',
      confirmado_em: '2026-10-19T10:00:00.000Z'
    })
    renderRoute('/', '/', <ConfirmacaoDaSessao appointment={sessao} />)
    expect(screen.queryByText('Confirmação pelo celular')).toBeNull()
  })
})
