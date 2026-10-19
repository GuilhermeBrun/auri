// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ToastInput } from '@renderer/lib/toast'
import { fakePatient, renderRoute } from '@renderer/testing'

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

import { PatientFormRoute } from './PatientFormPage'

const patient = fakePatient({ id: 3, nome: 'Pedro Fictício Souza' })
let setAtivo: ReturnType<typeof vi.fn>

beforeEach(() => {
  setAtivo = vi.fn(async (_id: number, ativo: boolean) => ({ ...patient, ativo }))
  Object.assign(window, { api: { patients: { get: vi.fn(async () => patient), setAtivo } } })
})

afterEach(cleanup)

describe('inativar paciente na ficha', () => {
  it('o aviso permite desfazer, reativando o cadastro', async () => {
    const toast = vi.fn()
    renderRoute('/pacientes/3', '/pacientes/:id', <PatientFormRoute />, toast)
    await userEvent.click(await screen.findByRole('button', { name: /Inativar/ }))
    await waitFor(() => expect(setAtivo).toHaveBeenCalledWith(3, false))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    const notice = toast.mock.calls[0][0] as ToastInput
    expect(notice.title).toBe('Paciente inativado')
    notice.action!.onClick()
    await waitFor(() => expect(setAtivo).toHaveBeenLastCalledWith(3, true))
    await waitFor(() =>
      expect(toast).toHaveBeenLastCalledWith({
        title: 'Paciente reativado',
        description: patient.nome
      })
    )
  })

  it('falha ao inativar aparece como aviso na página', async () => {
    setAtivo.mockRejectedValueOnce(new Error('database is locked'))
    renderRoute('/pacientes/3', '/pacientes/:id', <PatientFormRoute />)
    await userEvent.click(await screen.findByRole('button', { name: /Inativar/ }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível mudar o cadastro')
    expect(alert.textContent).toContain('database is locked')
  })
})
