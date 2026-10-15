// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { UpdateState } from '@shared/api'
import { renderRoute } from '@renderer/testing'

const { updates, emit } = vi.hoisted(() => {
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
    onChange: (next: (state: unknown) => void) => {
      listener = next
      return () => {}
    }
  }
  Object.assign(window, {
    platform: 'win32',
    backup: bridge(),
    connection: bridge(),
    prefs: bridge(),
    updates
  })
  return { updates, emit: (state: unknown) => listener(state) }
})

import { UpdatesPage } from './UpdatesPage'

const base: UpdateState = {
  version: '1.0.0',
  status: 'idle',
  next: null,
  progress: null,
  checkedAt: null,
  error: null
}

function show(state: Partial<UpdateState>): void {
  act(() => emit({ ...base, ...state }))
}

function renderPage(): void {
  renderRoute('/configuracoes/atualizacoes', '/configuracoes/atualizacoes', <UpdatesPage />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Configurações › Atualizações', () => {
  it('mostra a versão e procura na hora', async () => {
    renderPage()
    show({})
    expect(screen.getByRole('heading', { name: 'Versão 1.0.0' })).toBeTruthy()
    expect(screen.getByText(/procura versões novas sozinho/)).toBeTruthy()
    updates.check.mockResolvedValue({ ...base, status: 'checking' })
    await userEvent.click(screen.getByRole('button', { name: /Procurar agora/ }))
    expect(updates.check).toHaveBeenCalledOnce()
    expect(await screen.findByText('Procurando versão nova…')).toBeTruthy()
  })

  it('acompanha o download e reinicia com a versão pronta', async () => {
    renderPage()
    show({ status: 'downloading', next: '1.1.0', progress: 42 })
    expect(screen.getByText('Baixando a versão 1.1.0 (42%)…')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /Procurar agora/ }) as HTMLButtonElement).disabled
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
    await userEvent.click(screen.getByRole('button', { name: /Procurar agora/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('não autorizada')
    show({ status: 'unavailable' })
    expect(screen.getByText(/não procura versões novas sozinha/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
