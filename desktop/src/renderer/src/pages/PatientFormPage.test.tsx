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

describe('responsável na ficha', () => {
  let nextId = 40
  const abrir = async (
    over: Parameters<typeof fakePatient>[0]
  ): Promise<ReturnType<typeof vi.fn>> => {
    const id = nextId++
    const update = vi.fn(async (_id: number, input: unknown) => ({
      ...patient,
      ...(input as object)
    }))
    const atual = fakePatient({ id, nome: 'Pedro Fictício Souza', ...over })
    Object.assign(window, {
      api: { patients: { get: vi.fn(async () => atual), update, setAtivo } }
    })
    renderRoute(`/pacientes/${id}`, '/pacientes/:id', <PatientFormRoute />)
    await screen.findByDisplayValue(atual.nome)
    return update
  }

  it('sem escolha, a mãe aparece como responsável', async () => {
    await abrir({})
    expect(screen.getByRole('button', { name: 'Mãe', pressed: true })).toBeTruthy()
    expect(screen.getByText('Assina: Marina Fictícia Andrade')).toBeTruthy()
  })

  it('outra pessoa pede nome e parentesco antes de salvar', async () => {
    const update = await abrir({})
    await userEvent.click(screen.getByRole('button', { name: 'Outra pessoa' }))
    expect(screen.getByText(/só respondem pelo paciente menor de idade/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Informe o nome do responsável')).toBeTruthy()
    expect(screen.getByText('Escolha o parentesco')).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('paciente maior de idade assina ele mesmo e tem celular próprio', async () => {
    await abrir({ data_nascimento: '1990-03-02' })
    expect(await screen.findByText(/Paciente maior de idade/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Responsável pelo paciente' })).toBeNull()
    expect(screen.getAllByText('Celular')).toHaveLength(3)
  })
})

describe('imprimir a ficha', () => {
  it('gera o PDF da ficha salva e pede para salvar antes quando há alterações', async () => {
    const patientPdf = vi.fn(async () => undefined)
    Object.assign(window, {
      api: { patients: { get: vi.fn(async () => patient), setAtivo }, documents: { patientPdf } }
    })
    renderRoute('/pacientes/3', '/pacientes/:id', <PatientFormRoute />)
    const imprimir = (await screen.findByRole('button', {
      name: 'Imprimir ficha'
    })) as HTMLButtonElement
    await userEvent.click(imprimir)
    await waitFor(() => expect(patientPdf).toHaveBeenCalledWith(3))
    await userEvent.type(screen.getByLabelText('Professora'), 'Ana')
    expect(imprimir.disabled).toBe(true)
    expect(imprimir.title).toBe('Salve as alterações para imprimir')
  })
})
