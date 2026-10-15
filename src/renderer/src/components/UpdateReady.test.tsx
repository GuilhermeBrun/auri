// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { UpdateState } from '@shared/api'
import { ToastContext, type ToastInput } from '@renderer/lib/toast'

const { updates, emit } = vi.hoisted(() => {
  let listener: (state: unknown) => void = () => {}
  const updates = {
    info: vi.fn(() => new Promise(() => {})),
    install: vi.fn(() => Promise.resolve()),
    onChange: (next: (state: unknown) => void) => {
      listener = next
      return () => {}
    }
  }
  Object.assign(window, { updates })
  return { updates, emit: (state: unknown) => listener(state) }
})

import { UpdateReady } from './UpdateReady'

const idle: UpdateState = {
  version: '1.0.0',
  status: 'idle',
  next: null,
  progress: null,
  checkedAt: null,
  error: null
}

afterEach(cleanup)

describe('aviso de versão pronta', () => {
  it('avisa uma vez quando a versão termina de baixar e reinicia pelo aviso', () => {
    const toast = vi.fn<(input: ToastInput) => void>()
    render(
      <ToastContext value={toast}>
        <UpdateReady />
      </ToastContext>
    )
    act(() => emit({ ...idle, status: 'downloading', next: '1.1.0', progress: 10 }))
    expect(toast).not.toHaveBeenCalled()
    act(() => emit({ ...idle, status: 'ready', next: '1.1.0' }))
    act(() => emit({ ...idle, status: 'ready', next: '1.1.0' }))
    expect(toast).toHaveBeenCalledOnce()
    const [input] = toast.mock.calls[0]
    expect(input.title).toBe('Versão 1.1.0 pronta')
    input.action!.onClick()
    expect(updates.install).toHaveBeenCalledOnce()
  })
})
