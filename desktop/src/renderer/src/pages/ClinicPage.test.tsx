// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Clinic } from '@shared/schemas'
import { renderRoute } from '@renderer/testing'

const { clinic } = vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  const clinic = { get: vi.fn(), save: vi.fn(), chooseLogo: vi.fn() }
  Object.assign(window, {
    platform: 'win32',
    api: { clinic },
    backup: bridge(),
    connection: bridge(),
    prefs: bridge(),
    updates: bridge(),
    reports: bridge()
  })
  return { clinic }
})

import { ClinicPage } from './ClinicPage'

const LOGO = 'iVBORw0KGgo='

const vazia: Clinic = {
  nome: '',
  documento: '',
  endereco: '',
  telefone: '',
  whatsapp: '',
  profissional: '',
  registro: '',
  logo: '',
  updated_at: '2026-10-19T12:00:00.000Z'
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Clínica', () => {
  it('salva nome, WhatsApp com máscara e logo escolhido', async () => {
    clinic.get.mockResolvedValue(vazia)
    clinic.chooseLogo.mockResolvedValue(LOGO)
    clinic.save.mockImplementation((input) =>
      Promise.resolve({ ...input, updated_at: '2026-10-19T12:01:00.000Z' })
    )
    const toast = vi.fn()
    renderRoute('/clinica', '/clinica', <ClinicPage />, toast)

    const salvar = await screen.findByRole('button', { name: 'Salvar alterações' })
    expect((salvar as HTMLButtonElement).disabled).toBe(true)

    await userEvent.type(screen.getByLabelText('Nome da clínica'), 'Clínica Fictícia')
    await userEvent.type(screen.getByLabelText('WhatsApp da clínica'), '65999990000')
    await userEvent.click(screen.getByRole('button', { name: /Escolher logo/ }))
    expect(await screen.findByRole('img', { name: 'Logo da clínica' })).toBeTruthy()

    await userEvent.click(salvar)
    await waitFor(() => expect(clinic.save).toHaveBeenCalled())
    expect(clinic.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Clínica Fictícia',
        whatsapp: '(65) 99999-0000',
        logo: LOGO
      }),
      vazia.updated_at
    )
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Dados da clínica salvos' })
      )
    )
  })

  it('remove o logo', async () => {
    clinic.get.mockResolvedValue({ ...vazia, nome: 'Clínica Fictícia', logo: LOGO })
    renderRoute('/clinica', '/clinica', <ClinicPage />)
    await screen.findByRole('img', { name: 'Logo da clínica' })
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(screen.queryByRole('img', { name: 'Logo da clínica' })).toBeNull()
    expect(screen.getByText('Sem logo')).toBeTruthy()
  })

  it('recusa telefone incompleto', async () => {
    clinic.get.mockResolvedValue(vazia)
    renderRoute('/clinica', '/clinica', <ClinicPage />)
    await userEvent.type(await screen.findByLabelText('Telefone'), '6533')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Telefone inválido')).toBeTruthy()
    expect(clinic.save).not.toHaveBeenCalled()
  })
})
