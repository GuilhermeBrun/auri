// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Calendar } from './calendar'
import { toIsoDate } from '@shared/dates'

afterEach(cleanup)
describe('calendário', () => {
  it('setas atravessam meses e Enter entrega o dia escolhido', async () => {
    const onSelect = vi.fn()
    render(<Calendar value={new Date(2024, 1, 29)} onSelect={onSelect} />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    const active = grid.querySelector<HTMLElement>('[tabindex="0"]')!
    expect(active.dataset.date).toBe('2024-03-01')
    expect(document.activeElement).toBe(active)
    await userEvent.keyboard('{Enter}')
    expect(toIsoDate(onSelect.mock.calls[0][0] as Date)).toBe('2024-03-01')
  })

  it('Home e End respeitam a semana que começa no domingo', () => {
    render(<Calendar value={new Date(2026, 9, 14)} onSelect={vi.fn()} />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'Home' })
    expect(grid.querySelector<HTMLElement>('[tabindex="0"]')?.dataset.date).toBe('2026-10-11')
    fireEvent.keyDown(grid, { key: 'End' })
    expect(grid.querySelector<HTMLElement>('[tabindex="0"]')?.dataset.date).toBe('2026-10-17')
  })

  it('PageUp e PageDown com Shift atravessam anos sem criar 29 de fevereiro inválido', () => {
    render(<Calendar value={new Date(2024, 1, 29)} onSelect={vi.fn()} />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'PageDown', shiftKey: true })
    expect(grid.querySelector<HTMLElement>('[tabindex="0"]')?.dataset.date).toBe('2025-02-28')
    fireEvent.keyDown(grid, { key: 'PageUp', shiftKey: true })
    expect(grid.querySelector<HTMLElement>('[tabindex="0"]')?.dataset.date).toBe('2024-02-28')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe('março 2024')
  })
})
