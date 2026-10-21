// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WaitlistEntry } from '@shared/waitlist'
import { renderRoute } from '@renderer/testing'
import type { ToastInput } from '@renderer/lib/toast'

vi.hoisted(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }
})

import { WaitlistButton } from './WaitlistButton'
import { WaitlistPanel } from './WaitlistPanel'

const NOW = new Date(2026, 9, 19, 9, 0)

function entry(over: Partial<WaitlistEntry>): WaitlistEntry {
  return {
    id: 1,
    patient_id: 1,
    patient_nome: 'Helena Fictícia Andrade',
    tipo_id: 1,
    tipo_nome: 'Sessão',
    categoria: 'sessao',
    duracao: 45,
    dias: [],
    periodos: [],
    prioridade: 'normal',
    observacao: '',
    created_at: '2026-10-14T12:00:00.000Z',
    updated_at: '2026-10-14T12:00:00.000Z',
    ...over
  }
}

const helena = entry({ dias: [1, 3], periodos: ['tarde'], observacao: 'Só depois da escola' })
const caio = entry({
  id: 2,
  patient_id: 2,
  patient_nome: 'Caio Fictício Lima',
  prioridade: 'alta',
  created_at: '2026-10-19T11:00:00.000Z'
})

let api: {
  waitlist: Record<string, ReturnType<typeof vi.fn>>
  encaixe: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  api = {
    waitlist: {
      list: vi.fn(async () => [caio, helena]),
      getByPatient: vi.fn(async () => null),
      add: vi.fn(async () => helena),
      update: vi.fn(async () => helena),
      close: vi.fn(async () => undefined)
    },
    encaixe: {
      sugerir: vi.fn(async () => [
        { inicio: '2026-10-21T14:00', fim: '2026-10-21T14:45', preferida: true, encostada: true },
        { inicio: '2026-10-22T09:00', fim: '2026-10-22T09:45', preferida: false, encostada: true }
      ]),
      quemCabe: vi.fn(async () => [
        { espera: caio, inicio: '2026-10-21T14:00', fim: '2026-10-21T14:45', preferida: true }
      ])
    }
  }
  Object.assign(window, { api })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('painel da lista de espera', () => {
  it('lista quem espera com as preferências e o tempo de espera', async () => {
    renderRoute('/', '/', <WaitlistPanel />)
    expect(await screen.findByText('2 pacientes esperando horário')).toBeTruthy()
    const linhas = screen.getAllByRole('listitem')
    expect(within(linhas[0]).getByText('Caio Fictício Lima')).toBeTruthy()
    expect(within(linhas[0]).getByText('Prioridade')).toBeTruthy()
    expect(within(linhas[0]).getByText('Entrou hoje')).toBeTruthy()
    expect(within(linhas[1]).getByText('Sessão · 45 min · seg, qua · tarde')).toBeTruthy()
    expect(within(linhas[1]).getByText('Esperando há 5 dias')).toBeTruthy()
    expect(within(linhas[1]).getByText('Só depois da escola')).toBeTruthy()
    expect(within(linhas[1]).getByRole('link', { name: 'Helena Fictícia Andrade' })).toBeTruthy()
  })

  it('mostra os horários livres das próximas duas semanas e passa o escolhido', async () => {
    const onPick = vi.fn()
    renderRoute('/', '/', <WaitlistPanel onPick={onPick} />)
    const user = userEvent.setup()
    const botoes = await screen.findAllByRole('button', { name: 'Horários livres' })
    await user.click(botoes[1])
    expect(api.encaixe.sugerir).toHaveBeenCalledWith({
      patient_id: 1,
      duracao: 45,
      dias: [1, 3],
      periodos: ['tarde'],
      de: '2026-10-19',
      ate: '2026-11-01'
    })
    const lista = await screen.findByRole('list', {
      name: 'Horários livres para Helena Fictícia Andrade'
    })
    expect(within(lista).getByText('fora da preferência')).toBeTruthy()
    await user.click(within(lista).getByRole('button', { name: /qua, 21 de out · 14:00–14:45/ }))
    expect(onPick).toHaveBeenCalledWith(
      helena,
      expect.objectContaining({ inicio: '2026-10-21T14:00' })
    )
  })

  it('sem onPick os horários são só texto', async () => {
    renderRoute('/', '/', <WaitlistPanel />)
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: 'Horários livres' }))[0])
    expect(await screen.findByText('qua, 21 de out · 14:00–14:45')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /qua, 21 de out/ })).toBeNull()
  })

  it('lista vazia diz que ninguém espera', async () => {
    api.waitlist.list.mockResolvedValue([])
    renderRoute('/', '/', <WaitlistPanel />)
    expect(await screen.findByText('Ninguém esperando horário')).toBeTruthy()
  })

  it('com uma vaga mostra quem cabe nela', async () => {
    const onPick = vi.fn()
    renderRoute(
      '/',
      '/',
      <WaitlistPanel
        vaga={{ inicio: '2026-10-21T14:00', fim: '2026-10-21T15:00' }}
        onPick={onPick}
      />
    )
    expect(await screen.findByRole('heading', { name: 'Cabem neste horário' })).toBeTruthy()
    expect(screen.getByText('qua, 21 de out · 14:00–15:00')).toBeTruthy()
    expect(api.encaixe.quemCabe).toHaveBeenCalledWith({
      inicio: '2026-10-21T14:00',
      fim: '2026-10-21T15:00'
    })
    await userEvent.setup().click(await screen.findByRole('button', { name: /14:00–14:45/ }))
    expect(onPick).toHaveBeenCalledWith(caio, expect.objectContaining({ fim: '2026-10-21T14:45' }))
  })

  it('edita a espera e salva sem sobrescrever outra mudança', async () => {
    renderRoute('/', '/', <WaitlistPanel />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Editar a espera de Helena Fictícia Andrade' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Sessão de 45 min, segunda ou quarta, à tarde.')).toBeTruthy()
    const dias = within(dialog).getByRole('group', { name: 'Dias' })
    await user.click(within(dias).getByRole('button', { name: 'Seg' }))
    await user.click(within(dias).getByRole('button', { name: 'Sáb' }))
    await user.click(within(dialog).getByRole('switch', { name: 'Prioridade' }))
    expect(within(dialog).getByText('Sessão de 45 min, quarta ou sábado, à tarde.')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(api.waitlist.update).toHaveBeenCalledWith(
        1,
        {
          tipo_id: 1,
          duracao: 45,
          dias: [3, 6],
          periodos: ['tarde'],
          prioridade: 'alta',
          observacao: 'Só depois da escola'
        },
        helena.updated_at
      )
    )
  })
})

describe('botão da ficha', () => {
  const patient = { id: 1, nome: 'Helena Fictícia Andrade' }

  it('põe o paciente na lista', async () => {
    const toasts: ToastInput[] = []
    renderRoute('/', '/', <WaitlistButton patient={patient} />, (t) => toasts.push(t))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Pôr na lista de espera' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pôr na lista de espera' })
    expect(within(dialog).getByText('Sessão de 30 min, em qualquer dia e horário.')).toBeTruthy()
    await user.click(
      within(within(dialog).getByRole('group', { name: 'Período' })).getByRole('button', {
        name: 'Manhã'
      })
    )
    await user.click(within(dialog).getByRole('button', { name: 'Pôr na lista' }))
    await waitFor(() =>
      expect(api.waitlist.add).toHaveBeenCalledWith({
        duracao: 30,
        dias: [],
        periodos: ['manha'],
        prioridade: 'normal',
        observacao: '',
        patient_id: 1
      })
    )
    await waitFor(() => expect(toasts.map((t) => t.title)).toEqual(['Na lista de espera']))
  })

  it('dentro do formulário da ficha não envia a ficha junto', async () => {
    const ficha = vi.fn((e: React.FormEvent) => e.preventDefault())
    renderRoute(
      '/',
      '/',
      <form onSubmit={ficha}>
        <WaitlistButton patient={patient} />
      </form>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Pôr na lista de espera' }))
    await user.click(await screen.findByRole('button', { name: 'Pôr na lista' }))
    await waitFor(() => expect(api.waitlist.add).toHaveBeenCalled())
    expect(ficha).not.toHaveBeenCalled()
  })

  it('quem já está na lista abre a edição e pode sair dela', async () => {
    api.waitlist.getByPatient.mockResolvedValue(helena)
    renderRoute('/', '/', <WaitlistButton patient={patient} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Na lista de espera' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lista de espera' })
    await user.click(within(dialog).getByRole('button', { name: 'Tirar da lista' }))
    await user.click(within(dialog).getByRole('button', { name: 'Tirar' }))
    await waitFor(() => expect(api.waitlist.close).toHaveBeenCalledWith(1, { motivo: 'removido' }))
  })

  it('não aparece enquanto não sabe se o paciente está na lista', () => {
    api.waitlist.getByPatient.mockReturnValue(new Promise(() => {}))
    renderRoute('/', '/', <WaitlistButton patient={patient} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
