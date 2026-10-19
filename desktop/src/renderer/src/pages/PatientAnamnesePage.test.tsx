// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { emptyAnamneseInput, type Anamnese } from '@shared/schemas'
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

import { PatientAnamneseRoute } from './PatientAnamnesePage'

const patient = fakePatient({ id: 7 })
const blank: Anamnese = { ...emptyAnamneseInput(), patient_id: 7, updated_at: null }
let api: {
  patients: Record<string, ReturnType<typeof vi.fn>>
  anamneses: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  api = {
    patients: { get: vi.fn(async () => patient) },
    anamneses: {
      get: vi.fn(async () => blank),
      save: vi.fn(async (_id: number, input: Anamnese) => ({
        ...input,
        patient_id: 7,
        updated_at: '2026-10-14T18:30:00.000Z'
      }))
    }
  }
  Object.assign(window, { api })
})

afterEach(cleanup)

const open = (toast = vi.fn()): ReturnType<typeof renderRoute> =>
  renderRoute('/pacientes/7/anamnese', '/pacientes/:id/anamnese', <PatientAnamneseRoute />, toast)

async function topic(name: string): Promise<HTMLTextAreaElement> {
  const list = await screen.findByRole('navigation', { name: 'Temas da anamnese' })
  await userEvent.click(within(list).getByRole('button', { name: new RegExp(`^${name}`) }))
  return (await screen.findByLabelText(name, { selector: 'textarea' })) as HTMLTextAreaElement
}

describe('anamnese do paciente', () => {
  it('nova anamnese sugere a data de entrada e salva só depois de mudar algo', async () => {
    const toast = vi.fn()
    open(toast)
    const queixa = await topic('Queixa')
    expect((screen.getByLabelText('Data da anamnese') as HTMLInputElement).value).toBe('29/08/2026')
    const salvar = screen.getByRole('button', { name: 'Salvar anamnese' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    await userEvent.type(queixa, 'Troca letras ao falar.')
    await userEvent.click(salvar)
    await waitFor(() => expect(api.anamneses.save).toHaveBeenCalled())
    expect(api.anamneses.save.mock.calls[0][1]).toMatchObject({ queixa: 'Troca letras ao falar.' })
    expect(api.anamneses.save.mock.calls[0][2]).toBe('')
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'Anamnese salva', description: patient.nome })
    )
    expect(await screen.findByText(/Salva em 14 de out/)).toBeTruthy()
  })

  it('falha ao salvar mantém o texto e explica num aviso na página', async () => {
    api.anamneses.save.mockRejectedValueOnce(new Error('Outro computador salvou antes.'))
    open()
    const sono = await topic('Sono')
    await userEvent.type(sono, 'Dorme às 21h.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar anamnese' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível salvar a anamnese')
    expect(alert.textContent).toContain('Outro computador salvou antes.')
    expect((sono as HTMLTextAreaElement).value).toBe('Dorme às 21h.')
  })

  it('o que não foi salvo volta ao sair da aba e retornar', async () => {
    const first = open()
    await userEvent.type(await topic('Terapias'), 'Nenhuma.')
    first.unmount()
    open()
    expect(
      ((await screen.findByLabelText('Terapias', { selector: 'textarea' })) as HTMLTextAreaElement)
        .value
    ).toBe('Nenhuma.')
  })

  it('falha ao abrir mostra o erro e tenta de novo', async () => {
    api.anamneses.get.mockRejectedValueOnce(new Error('database is locked'))
    open()
    expect(await screen.findByText('Não foi possível abrir a anamnese')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(await screen.findByRole('navigation', { name: 'Temas da anamnese' })).toBeTruthy()
  })

  it('um tema por vez: pergunta-guia entra no texto e a lista marca o tema escrito', async () => {
    open()
    const gestacao = await topic('Gestação e nascimento')
    const list = screen.getByRole('navigation', { name: 'Temas da anamnese' })
    const item = within(list).getByRole('button', { name: /^Gestação/ })
    expect(item.getAttribute('aria-current')).toBe('step')
    expect(item.textContent).toContain('(vazio)')
    await userEvent.click(screen.getByRole('button', { name: 'Semanas:' }))
    await userEvent.keyboard('39')
    await userEvent.click(screen.getByRole('button', { name: 'Peso:' }))
    expect(gestacao.value).toBe('Semanas: 39\nPeso: ')
    expect(item.textContent).toContain('(escrito)')
    await userEvent.click(screen.getByRole('button', { name: 'Alimentação' }))
    expect(await screen.findByLabelText('Alimentação', { selector: 'textarea' })).toBeTruthy()
    expect(screen.queryByLabelText('Gestação e nascimento', { selector: 'textarea' })).toBeNull()
    expect((await topic('Gestação e nascimento')).value).toBe('Semanas: 39\nPeso: ')
  })
})
