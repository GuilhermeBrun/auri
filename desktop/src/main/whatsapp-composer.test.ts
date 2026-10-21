// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { runInThisContext } from 'node:vm'
import { COMPOSER } from './whatsapp-view'

vi.mock('electron', () => ({}))

const rodar = (): boolean => runInThisContext(COMPOSER) as boolean

function conversa(campo: string): boolean {
  document.body.innerHTML = `<div id="main"><footer>${campo}</footer></div>`
  return rodar()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('campo da conversa do WhatsApp Web', () => {
  it('foca o campo vazio do editor, mesmo com o texto de exemplo dentro', () => {
    expect(
      conversa(
        '<div contenteditable="true" data-lexical-editor="true"><p><br></p><span>Digite uma mensagem</span></div>'
      )
    ).toBe(true)
    expect(document.activeElement?.getAttribute('data-lexical-editor')).toBe('true')
  })

  it('não cola sobre um rascunho', () => {
    expect(
      conversa(
        '<div contenteditable="true" data-lexical-editor="true"><p><span data-lexical-text="true">rascunho</span></p></div>'
      )
    ).toBe(false)
    expect(conversa('<div contenteditable="true">rascunho</div>')).toBe(false)
  })

  it('sem conversa aberta, não acha campo', () => {
    document.body.innerHTML = '<div contenteditable="true"></div>'
    expect(rodar()).toBe(false)
    expect(conversa('<div contenteditable="true"> </div>')).toBe(true)
  })
})
