// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { UpdateState } from '@shared/api'
import { renderRoute } from '@renderer/testing'

const { updates, reports, emit } = vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  let listener: (state: unknown) => void = () => {}
  const updates = {
    info: vi.fn(() => new Promise(() => {})),
    check: vi.fn(),
    install: vi.fn(() => Promise.resolve()),
    setChannel: vi.fn(),
    onChange: (next: (state: unknown) => void) => {
      listener = next
      return () => {}
    }
  }
  const reports = {
    info: vi.fn(() => new Promise(() => {})),
    setEnabled: vi.fn(),
    copy: vi.fn(() => Promise.resolve()),
    error: vi.fn()
  }
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {}
  })
  Object.assign(window, {
    platform: 'win32',
    backup: bridge(),
    connection: bridge(),
    prefs: bridge(),
    updates,
    reports
  })
  return { updates, reports, emit: (state: unknown) => listener(state) }
})

import { GeneralPage } from './GeneralPage'

const base: UpdateState = {
  version: '1.0.0',
  channel: 'latest',
  status: 'idle',
  next: null,
  progress: null,
  checkedAt: null,
  error: null
}

function show(state: Partial<UpdateState>): void {
  act(() => emit({ ...base, ...state }))
}

function renderPage(toast = vi.fn()): ReturnType<typeof vi.fn> {
  renderRoute('/configuracoes/geral', '/configuracoes/geral', <GeneralPage />, toast)
  return toast
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Configurações › Geral', () => {
  it('mostra a versão e procura na hora', async () => {
    const toast = renderPage()
    show({})
    expect(screen.getByText('1.0.0')).toBeTruthy()
    expect(screen.getByText(/procura versões novas sozinho/)).toBeTruthy()
    updates.check.mockResolvedValue({ ...base, status: 'checking' })
    await userEvent.click(screen.getByRole('button', { name: /Procurar atualizações/ }))
    expect(updates.check).toHaveBeenCalledOnce()
    expect(await screen.findByText('Procurando versão nova…')).toBeTruthy()
    expect(toast).not.toHaveBeenCalled()
  })

  it('acompanha o download e reinicia com a versão pronta', async () => {
    renderPage()
    show({ status: 'downloading', next: '1.1.0', progress: 42 })
    expect(screen.getByText('Baixando a versão 1.1.0 (42%)…')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /Procurar atualizações/ }) as HTMLButtonElement).disabled
    ).toBe(true)
    show({ status: 'ready', next: '1.1.0' })
    expect(screen.getByText(/A versão 1.1.0 está pronta/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Reiniciar e atualizar/ }))
    expect(updates.install).toHaveBeenCalledOnce()
  })

  it('explica a procura anterior, a falha e a instalação que não se atualiza sozinha', async () => {
    renderPage()
    show({ checkedAt: new Date().toISOString() })
    expect(screen.getByText(/Esta é a versão mais nova. Procurado hoje às/)).toBeTruthy()
    show({ status: 'error', error: 'Sem internet.' })
    expect(screen.getByText('Sem internet.')).toBeTruthy()
    updates.check.mockRejectedValue(new Error('Origem da chamada não autorizada'))
    await userEvent.click(screen.getByRole('button', { name: /Procurar atualizações/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('não autorizada')
    show({ status: 'unavailable' })
    expect(screen.getByText(/não procura versões novas sozinha/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('troca o canal entre estável e alpha', async () => {
    renderPage()
    show({})
    const channel = screen.getByRole('combobox', { name: 'Canal de atualização' })
    expect(channel.textContent).toContain('Estável')
    updates.setChannel.mockResolvedValue({ ...base, channel: 'alpha', status: 'checking' })
    await userEvent.click(channel)
    await userEvent.click(await screen.findByRole('option', { name: 'Alpha' }))
    expect(updates.setChannel).toHaveBeenCalledExactlyOnceWith('alpha')
    expect(screen.getByText(/Pode ter erros/)).toBeTruthy()

    show({ channel: 'alpha', status: 'ready', next: '1.1.1' })
    expect(
      screen.getByRole('combobox', { name: 'Canal de atualização' }).hasAttribute('disabled')
    ).toBe(true)
  })

  it('liga e desliga o envio dos relatórios de erro e copia as falhas guardadas', async () => {
    reports.info.mockResolvedValueOnce({ enabled: true, count: 0 })
    const toast = renderPage()
    const toggle = await screen.findByRole('switch', { name: 'Enviar relatórios de erro' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/Nenhum dado de paciente vai junto/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Copiar relatório/ })).toBeNull()

    reports.setEnabled.mockResolvedValue({ enabled: false, count: 2 })
    await userEvent.click(toggle)
    expect(reports.setEnabled).toHaveBeenCalledExactlyOnceWith(false)
    expect(await screen.findByText(/as falhas ficam só neste computador/)).toBeTruthy()
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(/2 falhas guardadas/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Copiar relatório/ }))
    expect(reports.copy).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Relatório copiado' }))
  })
})
