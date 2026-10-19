// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '@shared/agenda'
import type { Clinic } from '@shared/schemas'
import { renderRoute } from '@renderer/testing'

const { clinic } = vi.hoisted(() => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {}
  })
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key === 'onChange' ? () => {} : new Promise(() => {})))
    })
  const clinic = { get: vi.fn(), save: vi.fn(), chooseLogo: vi.fn() }
  const terms = { models: vi.fn(() => Promise.resolve([])) }
  Object.assign(window, {
    platform: 'win32',
    api: { clinic, terms },
    backup: bridge(),
    connection: bridge(),
    prefs: bridge(),
    updates: bridge(),
    reports: bridge()
  })
  return { clinic }
})

import { ClinicPage } from './ClinicPage'

globalThis.ResizeObserver ??= class {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

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
  margem_deslocamento: 30,
  funcionamento: FUNCIONAMENTO_PADRAO,
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

  it('abre o domingo, fecha o sábado e salva o funcionamento', async () => {
    clinic.get.mockResolvedValue(vazia)
    clinic.save.mockImplementation((input) =>
      Promise.resolve({ ...input, updated_at: '2026-10-19T12:01:00.000Z' })
    )
    renderRoute('/clinica', '/clinica', <ClinicPage />)
    const domingo = await screen.findByRole('switch', { name: 'Abre no domingo' })
    expect(domingo.getAttribute('aria-checked')).toBe('false')
    expect(
      screen.getByRole('switch', { name: 'Abre no sábado' }).getAttribute('aria-checked')
    ).toBe('true')
    expect((screen.getByLabelText('Sábado, fecha às') as HTMLInputElement).value).toBe('12:00')

    await userEvent.click(domingo)
    await userEvent.click(screen.getByRole('switch', { name: 'Abre no sábado' }))
    expect(screen.queryByLabelText('Sábado, fecha às')).toBeNull()
    const fecha = screen.getByLabelText('Domingo, fecha às')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '12:00')
    await userEvent.tab()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(clinic.save).toHaveBeenCalled())
    const { 6: _, ...semSabado } = FUNCIONAMENTO_PADRAO
    expect(clinic.save.mock.calls[0][0].funcionamento).toEqual({
      ...semSabado,
      0: { abre: '07:00', fecha: '12:00' }
    })
  })

  it('salva a margem de deslocamento junto do funcionamento', async () => {
    clinic.get.mockResolvedValue(vazia)
    clinic.save.mockImplementation((input) =>
      Promise.resolve({ ...input, updated_at: '2026-10-19T12:01:00.000Z' })
    )
    renderRoute('/clinica', '/clinica', <ClinicPage />)
    const margem = await screen.findByRole('combobox', { name: 'Margem de deslocamento' })
    expect(margem.textContent).toContain('30 min')
    await userEvent.click(margem)
    await userEvent.click(await screen.findByRole('option', { name: '60 min' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(clinic.save).toHaveBeenCalled())
    expect(clinic.save.mock.calls[0][0].margem_deslocamento).toBe(60)
  })

  it('recusa um dia que fecha antes de abrir', async () => {
    clinic.get.mockResolvedValue(vazia)
    renderRoute('/clinica', '/clinica', <ClinicPage />)
    const fecha = await screen.findByLabelText('Segunda, fecha às')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '06:00')
    await userEvent.tab()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Fecha depois de abrir')).toBeTruthy()
    expect(clinic.save).not.toHaveBeenCalled()
  })
})
