// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { TimeField } from './time-field'

afterEach(cleanup)
const slots = ['09:00', '09:15', '09:30', '09:45']

describe('campo de horário', () => {
  it('completa o horário digitado ao sair do campo sem escolher outra sugestão', async () => {
    const onChange = vi.fn()
    render(<TimeField value="" onChange={onChange} slots={slots} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '930')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith('09:30')
    expect((input as HTMLInputElement).value).toBe('09:30')
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('setas e Enter escolhem a sugestão mantendo o foco no campo', async () => {
    const onChange = vi.fn()
    render(<TimeField value="09:00" onChange={onChange} slots={slots} />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('09:15')
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('Escape fecha as sugestões sem mudar o valor', async () => {
    const onChange = vi.fn()
    render(<TimeField value="09:30" onChange={onChange} slots={slots} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('{ArrowDown}{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false')
  })

  it('horário inválido permanece disponível para o formulário recusar', () => {
    const onChange = vi.fn()
    render(<TimeField value="" onChange={onChange} slots={slots} invalid />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '29:99' } })
    fireEvent.blur(input)
    expect((input as HTMLInputElement).value).toBe('29:99')
    expect(onChange).toHaveBeenLastCalledWith('29:99')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('acompanha uma troca externa de valor sem reutilizar o rascunho', () => {
    const props = { onChange: vi.fn(), slots }
    const { rerender } = render(<TimeField {...props} value="09:00" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '10:3' } })
    rerender(<TimeField {...props} value="09:45" />)
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('09:45')
  })

  it('seleção pelo mouse escolhe antes do blur e não envia o formulário', () => {
    const onChange = vi.fn()
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={submit}>
        <TimeField value="09:00" onChange={onChange} slots={slots} />
      </form>
    )
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.mouseDown(screen.getByRole('option', { name: '09:45' }))
    expect(onChange).toHaveBeenLastCalledWith('09:45')
    expect(submit).not.toHaveBeenCalled()
  })
})
