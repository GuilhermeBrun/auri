// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DateField } from './date-field'

afterEach(cleanup)

describe('campo de data', () => {
  it('mostra a data brasileira e entrega ISO somente para uma data existente', () => {
    const onChange = vi.fn()
    render(<DateField value="2026-10-14" onChange={onChange} />)
    const input = screen.getByPlaceholderText('dd/mm/aaaa') as HTMLInputElement
    expect(input.value).toBe('14/10/2026')
    fireEvent.change(input, { target: { value: '29022024' } })
    expect(onChange).toHaveBeenLastCalledWith('2024-02-29')
    fireEvent.change(input, { target: { value: '29022025' } })
    expect(onChange).toHaveBeenLastCalledWith('29/02/2025')
    expect(input.value).toBe('29/02/2025')
  })

  it('mantém uma data incompleta como inválida em vez de apagar a entrada', () => {
    const onChange = vi.fn()
    render(<DateField value="" onChange={onChange} invalid />)
    const input = screen.getByPlaceholderText('dd/mm/aaaa') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1410' } })
    expect(input.value).toBe('14/10')
    expect(onChange).toHaveBeenLastCalledWith('14/10')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('carregar outra ficha e limpar o valor substituem o rascunho exibido', () => {
    const onChange = vi.fn()
    const { rerender } = render(<DateField value="2026-10-14" onChange={onChange} />)
    const input = screen.getByPlaceholderText('dd/mm/aaaa') as HTMLInputElement
    fireEvent.change(input, { target: { value: '123' } })
    rerender(<DateField value="2025-01-02" onChange={onChange} />)
    expect(input.value).toBe('02/01/2025')
    rerender(<DateField value="" onChange={onChange} />)
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('escolher um dia no calendário entrega ISO e devolve o foco ao campo', async () => {
    const onChange = vi.fn()
    render(<DateField value="2026-10-14" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'quinta-feira, 15 de outubro de 2026'
      })
    )
    expect(onChange).toHaveBeenLastCalledWith('2026-10-15')
    expect((screen.getByPlaceholderText('dd/mm/aaaa') as HTMLInputElement).value).toBe('15/10/2026')
    expect(document.activeElement).toBe(screen.getByPlaceholderText('dd/mm/aaaa'))
  })

  it('seta abre o calendário e Escape devolve o foco sem alterar a data', async () => {
    const onChange = vi.fn()
    render(<DateField value="2026-10-14" onChange={onChange} />)
    const input = screen.getByPlaceholderText('dd/mm/aaaa')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')
    expect(await screen.findByRole('grid')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(input)
  })
})
