// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { UpdateState } from '@shared/api'
import { renderRoute } from '@renderer/testing'

const { updates, emit } = vi.hoisted(() => {
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
  Object.assign(window, { platform: 'win32', updates })
  return { updates, emit: (state: unknown) => listener(state) }
})

import { UpdateCorner } from './UpdateCorner'

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

function renderCorner(toast = vi.fn()): ReturnType<typeof vi.fn> {
  renderRoute('/configuracoes', '/configuracoes', <UpdateCorner />, toast)
  return toast
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Atualização no rodapé das Configurações', () => {
  it('procura na hora e avisa quando já é a mais nova', async () => {
    const toast = renderCorner()
    show({})
    updates.check.mockResolvedValue({ ...base, checkedAt: new Date().toISOString() })
    await userEvent.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(updates.check).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith({ title: 'Esta é a versão mais nova' })
  })

  it('avisa a falha da procura', async () => {
    const toast = renderCorner()
    show({})
    updates.check.mockRejectedValue(new Error('Sem internet.'))
    await userEvent.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(toast).toHaveBeenCalledWith({
      title: 'Não foi possível procurar',
      description: 'Sem internet.'
    })
  })

  it('espera o download e reinicia com a versão pronta', async () => {
    renderCorner()
    show({ status: 'downloading', next: '1.1.0', progress: 42 })
    expect(
      (screen.getByRole('button', { name: 'Baixando a versão 1.1.0 (42%)' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    show({ status: 'ready', next: '1.1.0' })
    await userEvent.click(
      screen.getByRole('button', { name: 'Reiniciar e atualizar para a versão 1.1.0' })
    )
    expect(updates.install).toHaveBeenCalledOnce()
  })

  it('some sem atualização automática', () => {
    renderCorner()
    show({ status: 'unavailable' })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
