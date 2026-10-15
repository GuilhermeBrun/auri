// @vitest-environment jsdom
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { useDraft } from './drafts'

afterEach(cleanup)

type Result = { take: () => string | null; discard: () => void }

function Probe({
  id,
  base,
  dirty,
  value,
  onResult
}: {
  id: string | null
  base: string | null | undefined
  dirty: boolean
  value: string
  onResult: (result: Result) => void
}): null {
  onResult(useDraft<string>(id, base, dirty, () => value))
  return null
}

const mount = (
  props: Omit<React.ComponentProps<typeof Probe>, 'onResult'>
): { current: Result | null } => {
  const out = { current: null as Result | null }
  render(<Probe {...props} onResult={(result) => (out.current = result)} />)
  return out
}

describe('rascunho ao trocar de tela', () => {
  it('guarda o que não foi salvo ao sair e devolve uma vez ao voltar', () => {
    mount({ id: 'r1', base: 'v1', dirty: true, value: 'texto digitado' })
    cleanup()
    const back = mount({ id: 'r1', base: 'v1', dirty: false, value: '' })
    expect(back.current!.take()).toBe('texto digitado')
    expect(back.current!.take()).toBeNull()
  })

  it('esquece o rascunho se o registro foi salvo em outro lugar enquanto esperava', () => {
    mount({ id: 'r2', base: 'v1', dirty: true, value: 'antigo' })
    cleanup()
    expect(mount({ id: 'r2', base: 'v2', dirty: false, value: '' }).current!.take()).toBeNull()
  })

  it('não guarda nada depois de salvar nem quando não houve mudança', () => {
    const saved = mount({ id: 'r3', base: 'v1', dirty: true, value: 'salvo' })
    saved.current!.discard()
    cleanup()
    expect(mount({ id: 'r3', base: 'v1', dirty: false, value: '' }).current!.take()).toBeNull()

    mount({ id: 'r4', base: 'v1', dirty: false, value: 'igual' })
    cleanup()
    expect(mount({ id: 'r4', base: 'v1', dirty: false, value: '' }).current!.take()).toBeNull()
  })

  it('sem chave ou com o registro ainda carregando, não guarda', () => {
    mount({ id: null, base: 'v1', dirty: true, value: 'sem chave' })
    mount({ id: 'r5', base: undefined, dirty: true, value: 'carregando' })
    cleanup()
    expect(mount({ id: 'r5', base: undefined, dirty: false, value: '' }).current!.take()).toBeNull()
  })
})
