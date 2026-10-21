// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const { prefs } = vi.hoisted(() => {
  const bridge = (): unknown =>
    new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        (target[key] ??= () => (key.startsWith('on') ? () => {} : new Promise(() => {})))
    })
  const prefs = {
    initial: {
      sidebarOpen: true,
      sidebarItems: { order: [], hidden: [] },
      atalhos: {},
      theme: 'system',
      whatsapp: true,
      recepcao: false,
      textSize: 1,
      colors: { accent: null, canvas: null, overrides: { light: {}, dark: {} } }
    },
    save: vi.fn(),
    onChange: () => () => {}
  }
  Object.assign(window, { platform: 'darwin', prefs, backup: bridge(), connection: bridge() })
  return { prefs }
})

globalThis.ResizeObserver ??= class {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

import { restaurarAtalhos, useAtalhos } from '@renderer/lib/atalhos'
import { AtalhosPage } from './AtalhosPage'

afterEach(() => {
  cleanup()
  act(() => restaurarAtalhos())
  vi.clearAllMocks()
})

function Hoje({ onHoje }: { onHoje: () => void }): React.JSX.Element {
  useAtalhos({ 'agenda-hoje': onHoje })
  return <input aria-label="Campo" />
}

function abrir(): ReturnType<typeof vi.fn> {
  const onHoje = vi.fn()
  render(
    <MemoryRouter>
      <AtalhosPage />
      <Hoje onHoje={onHoje} />
    </MemoryRouter>
  )
  return onHoje
}

describe('Configurações › Atalhos', () => {
  it('mostra os padrões do Mac, inclusive os fixos', () => {
    abrir()
    expect(
      screen.getByRole('button', {
        name: 'Trocar o atalho de Mostrar ou ocultar a barra lateral: ⌃⌘S'
      })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trocar o atalho de Ir para hoje: T' })).toBeTruthy()
    expect(screen.getByText('Aumentar o texto')).toBeTruthy()
  })

  it('grava um atalho novo, que passa a valer na hora', async () => {
    const onHoje = abrir()
    await userEvent.click(screen.getByRole('button', { name: /Ir para hoje/ }))
    await userEvent.keyboard('h')
    expect(prefs.save).toHaveBeenLastCalledWith({ atalhos: { 'agenda-hoje': 'KeyH' } })
    expect(screen.getByRole('button', { name: 'Trocar o atalho de Ir para hoje: H' })).toBeTruthy()
    await userEvent.click(document.body)
    await userEvent.keyboard('t')
    expect(onHoje).not.toHaveBeenCalled()
    await userEvent.keyboard('h')
    expect(onHoje).toHaveBeenCalledOnce()
  })

  it('não dispara tecla sozinha dentro de um campo', async () => {
    const onHoje = abrir()
    await userEvent.click(screen.getByRole('textbox', { name: 'Campo' }))
    await userEvent.keyboard('t')
    expect(onHoje).not.toHaveBeenCalled()
  })

  it('avisa conflito e atalho do sistema, e continua esperando', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Ir para hoje/ }))
    await userEvent.keyboard('d')
    expect(screen.getByRole('alert').textContent).toBe('D já é o atalho de “Ver o dia”.')
    await userEvent.keyboard('{Meta>}c{/Meta}')
    expect(screen.getByRole('alert').textContent).toBe('⌘C é do sistema. Escolha outro.')
    expect(prefs.save).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Trocar o atalho de Ir para hoje: T' })).toBeTruthy()
  })

  it('apaga o atalho e volta ao padrão', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Ir para hoje/ }))
    await userEvent.keyboard('{Backspace}')
    expect(prefs.save).toHaveBeenLastCalledWith({ atalhos: { 'agenda-hoje': null } })
    expect(
      screen.getByRole('button', { name: 'Trocar o atalho de Ir para hoje: sem atalho' })
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar Ir para hoje ao padrão' }))
    expect(prefs.save).toHaveBeenLastCalledWith({ atalhos: {} })
    expect(screen.getByRole('button', { name: 'Trocar o atalho de Ir para hoje: T' })).toBeTruthy()
  })
})
