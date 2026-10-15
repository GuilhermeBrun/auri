// @vitest-environment jsdom
import React, { createRef, useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Badge } from './badge'
import { Callout } from './callout'
import { ConfirmAction } from './confirm-action'
import { SearchField } from './search-field'

afterEach(cleanup)

describe('selo', () => {
  it('mostra a palavra e o ícone no tom pedido', () => {
    render(
      <Badge tone="warning" icon={<svg data-testid="icone" />}>
        Cópia parada
      </Badge>
    )
    const badge = screen.getByText('Cópia parada')
    expect(badge.className).toContain('bg-warning-soft')
    expect(screen.getByTestId('icone')).toBeTruthy()
  })
})

describe('aviso na página', () => {
  it('erro e atenção são anunciados; explicação neutra é só nota', () => {
    const { rerender } = render(<Callout title="Os dados ficam aqui">Na recepção.</Callout>)
    expect(screen.getByRole('note').textContent).toContain('Na recepção.')
    rerender(
      <Callout tone="danger" title="Não foi possível salvar" action={<button>Tentar</button>}>
        Disco cheio.
      </Callout>
    )
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível salvar')
    expect(screen.getByRole('button', { name: 'Tentar' })).toBeTruthy()
  })
})

describe('busca', () => {
  function Busca({ onRef }: { onRef?: (el: HTMLInputElement | null) => void }): React.JSX.Element {
    const [value, setValue] = useState('')
    return (
      <SearchField
        value={value}
        onChange={setValue}
        placeholder="Nome"
        label="Buscar"
        ref={onRef}
      />
    )
  }

  it('limpa pelo botão próprio e devolve o foco ao campo', async () => {
    render(<Busca />)
    const input = screen.getByLabelText('Buscar') as HTMLInputElement
    await userEvent.type(input, 'Helena')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()
  })

  it('Esc com texto limpa sem deixar o Esc chegar a quem está em volta', async () => {
    const outside = vi.fn()
    const ref = createRef<HTMLInputElement>()
    render(
      <div onKeyDown={(e) => e.key === 'Escape' && outside()}>
        <SearchField value="Ana" onChange={() => {}} placeholder="Nome" label="Buscar" ref={ref} />
      </div>
    )
    expect(ref.current).toBe(screen.getByLabelText('Buscar'))
    await userEvent.type(ref.current!, '{Escape}')
    expect(outside).not.toHaveBeenCalled()
  })

  it('aceita uma função como ref', () => {
    const onRef = vi.fn()
    render(<Busca onRef={onRef} />)
    expect(onRef).toHaveBeenCalledWith(screen.getByLabelText('Buscar'))
  })
})

describe('confirmação no lugar', () => {
  it('pergunta antes, permite desistir e só então confirma', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmAction
        question="Excluir este agendamento?"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
      >
        Excluir agendamento
      </ConfirmAction>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Excluir agendamento' }))
    expect(screen.getByText('Excluir este agendamento?')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir agendamento' }))
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('controlada por fora, avisa a troca de passo', async () => {
    const onConfirmingChange = vi.fn()
    render(
      <ConfirmAction
        question="Cortar o acesso?"
        confirmLabel="Remover"
        cancelLabel="Manter"
        confirming
        onConfirmingChange={onConfirmingChange}
        onConfirm={() => {}}
      >
        Remover
      </ConfirmAction>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Manter' }))
    expect(onConfirmingChange).toHaveBeenCalledWith(false)
  })
})
