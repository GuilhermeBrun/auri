// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { TermCheck, TermRequest } from '@shared/schemas'
import { renderRoute } from '@renderer/testing'

const { terms } = vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  const terms = { check: vi.fn(), accept: vi.fn(), openPdf: vi.fn() }
  Object.assign(window, {
    platform: 'darwin',
    api: { terms },
    backup: bridge(),
    connection: bridge(),
    prefs: bridge()
  })
  return { terms }
})

import { closeReceive, openReceive } from '@renderer/lib/terms'
import { ReceiveTerm } from './ReceiveTerm'

const TRACO = 'AQRkyAGQA58BkAOYApAD7wE'

const request = {
  id: 3,
  titulo: 'Consentimento',
  versao: 1,
  destino_numero: '5565999991234',
  assinado: null
} as unknown as TermRequest

const conferido: TermCheck = {
  ok: true,
  request,
  patient_nome: 'Helena Fictícia',
  resposta: {
    nome: 'Marina Fictícia',
    cpf: '12345678909',
    papel: 'pai',
    parentesco: 'Pai',
    assinado_em: Math.floor(Date.UTC(2026, 9, 19, 18, 32) / 1000),
    fuso_minutos: -240
  },
  traco: TRACO,
  avisos: ['O termo foi enviado para a mãe, e quem assinou foi o pai.']
}

afterEach(() => {
  act(() => closeReceive())
  cleanup()
  vi.clearAllMocks()
})

describe('conferência do termo assinado', () => {
  it('cola a resposta, mostra quem assinou e os avisos, e guarda', async () => {
    terms.check.mockResolvedValue(conferido)
    terms.accept.mockResolvedValue({
      ...request,
      assinado: { nome: 'Marina Fictícia' }
    })
    const toast = vi.fn()
    renderRoute('/', '/', <ReceiveTerm />, toast)
    act(() => openReceive())
    await userEvent.type(
      await screen.findByLabelText('Resposta que chegou pelo WhatsApp'),
      'https://auri.dev.br/recebido#1.a.b'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Marina Fictícia')).toBeTruthy()
    expect(screen.getByText('Pai')).toBeTruthy()
    expect(
      screen.getByText('O termo foi enviado para a mãe, e quem assinou foi o pai.')
    ).toBeTruthy()
    expect(screen.getByText(/Enviado para \(65\) 99999-1234/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /CPF: oculto/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar termo assinado' }))
    await waitFor(() =>
      expect(terms.accept).toHaveBeenCalledWith(
        'https://auri.dev.br/recebido#1.a.b',
        'Este computador'
      )
    )
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Termo guardado' }))
    )
  })

  it('resposta recusada não tem como guardar', async () => {
    terms.check.mockResolvedValue({
      ok: false,
      erro: 'O texto assinado não é o que foi enviado.',
      guardado: null
    })
    renderRoute('/', '/', <ReceiveTerm />)
    act(() => openReceive('1.a.b'))
    expect(await screen.findByText('O texto assinado não é o que foi enviado.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar termo assinado' })).toBeNull()
  })

  it('resposta já guardada oferece o PDF', async () => {
    terms.check.mockResolvedValue({ ok: false, erro: 'Este termo já está guardado.', guardado: 9 })
    terms.openPdf.mockResolvedValue(undefined)
    renderRoute('/', '/', <ReceiveTerm />)
    act(() => openReceive('1.a.b'))
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir PDF' }))
    expect(terms.openPdf).toHaveBeenCalledWith(9)
  })
})
