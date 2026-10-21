// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { UiPrefs } from '@shared/schemas'

const { prefs, emit } = vi.hoisted(() => {
  const listeners = new Set<(next: UiPrefs) => void>()
  const prefs = {
    initial: {
      sidebarOpen: true,
      sidebarItems: { order: [], hidden: [] },
      theme: 'system',
      whatsapp: false,
      recepcao: false,
      textSize: 1,
      colors: { accent: null, canvas: null, overrides: { light: {}, dark: {} } }
    },
    save: vi.fn(),
    onChange: (next: (value: UiPrefs) => void) => {
      listeners.add(next)
      return () => listeners.delete(next)
    }
  }
  Object.assign(window, { prefs })
  return {
    prefs,
    emit: (next: Partial<UiPrefs>) => {
      for (const listener of listeners) listener({ ...prefs.initial, ...next } as UiPrefs)
    }
  }
})

import { saveSidebarItems } from '@renderer/lib/sidebar'
import { SidebarEditor } from './SidebarEditor'

globalThis.ResizeObserver ??= class {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

async function abrir(): Promise<void> {
  render(<SidebarEditor />)
  screen.getByRole('button', { name: 'Personalizar a barra lateral' }).focus()
  await userEvent.keyboard('{Enter}')
}

afterEach(() => {
  cleanup()
  act(() => saveSidebarItems({ order: [], hidden: [] }))
  vi.clearAllMocks()
})

const labels = (): string[] =>
  screen
    .getAllByRole('listitem')
    .sort(
      (a, b) => Number(a.getAttribute('aria-posinset')) - Number(b.getAttribute('aria-posinset'))
    )
    .map((li) => li.textContent ?? '')

describe('Personalizar a barra lateral', () => {
  it('abre pelo botão de três pontos e lista o que está disponível, sem o WhatsApp desligado', async () => {
    await abrir()
    expect(screen.getByRole('dialog', { name: 'Personalizar a barra lateral' })).toBeTruthy()
    expect(labels()).toEqual(['Agenda', 'Pacientes', 'Financeiro', 'Clínica'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mover Agenda' }))
  })

  it('aberto com o mouse, não acende a alça do primeiro item', async () => {
    render(<SidebarEditor />)
    await userEvent.click(screen.getByRole('button', { name: 'Personalizar a barra lateral' }))
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('muda a ordem pelo teclado e guarda a ordem inteira', async () => {
    await abrir()
    await userEvent.keyboard('{ArrowDown}')
    expect(labels()).toEqual(['Pacientes', 'Agenda', 'Financeiro', 'Clínica'])
    expect(prefs.save).toHaveBeenLastCalledWith({
      sidebarItems: {
        order: ['pacientes', 'agenda', 'financeiro', 'clinica', 'whatsapp'],
        hidden: []
      }
    })
    expect(screen.getByRole('status').textContent).toBe('Agenda, 2 de 4')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mover Agenda' }))
  })

  it('oculta e mostra, sempre deixando um item que não some com a recepção', async () => {
    await abrir()
    for (const label of ['Agenda', 'Pacientes']) {
      await userEvent.click(screen.getByRole('switch', { name: `Mostrar ${label}` }))
    }
    expect(screen.getByRole('switch', { name: 'Mostrar Financeiro' })).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByRole('switch', { name: 'Mostrar Clínica' })).toHaveProperty(
      'disabled',
      false
    )
    expect(prefs.save).toHaveBeenLastCalledWith({
      sidebarItems: { order: [], hidden: ['agenda', 'pacientes'] }
    })
    await userEvent.click(screen.getByRole('switch', { name: 'Mostrar Agenda' }))
    expect(screen.getByRole('switch', { name: 'Mostrar Financeiro' })).toHaveProperty(
      'disabled',
      false
    )
  })

  it('restaura o padrão e fecha com Esc', async () => {
    await abrir()
    expect(screen.queryByRole('button', { name: 'Restaurar o padrão' })).toBeNull()
    await userEvent.click(screen.getByRole('switch', { name: 'Mostrar Financeiro' }))
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(labels()[0]).toBe('Financeiro')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar o padrão' }))
    expect(prefs.save).toHaveBeenLastCalledWith({ sidebarItems: { order: [], hidden: [] } })
    expect(screen.getByRole('switch', { name: 'Mostrar Financeiro' })).toHaveProperty(
      'ariaChecked',
      'true'
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mover Agenda' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('acompanha a mudança feita em outra janela', async () => {
    await abrir()
    act(() => emit({ sidebarItems: { order: ['clinica'], hidden: [] } }))
    expect(labels()[0]).toBe('Clínica')
  })
})
