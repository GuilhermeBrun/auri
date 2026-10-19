// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(cleanup)

let broken = true

function Agenda(): React.JSX.Element {
  if (broken) throw new TypeError('x is not a function')
  return <p>Agenda</p>
}

describe('ErrorBoundary', () => {
  it('mostra o aviso no lugar da tela que falhou e tenta de novo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Agenda />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert').textContent).toContain('Esta tela não abriu')
    broken = false
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(screen.getByText('Agenda')).toBeTruthy()
  })
})
