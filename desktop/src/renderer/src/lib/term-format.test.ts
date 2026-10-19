import { describe, expect, it } from 'vite-plus/test'
import { formatar } from './term-format'

describe('formatar', () => {
  it('põe negrito na seleção', () => {
    expect(formatar('Assino abaixo.', 7, 13, null)).toEqual({
      texto: 'Assino **abaixo**.',
      start: 9,
      end: 15
    })
  })

  it('negrito sem seleção deixa uma palavra selecionada para trocar', () => {
    expect(formatar('A ', 2, 2, null)).toEqual({ texto: 'A **texto**', start: 4, end: 9 })
  })

  it('título vale para a linha do cursor e troca o prefixo que já existe', () => {
    const texto = '# Termo\n\n## Assinatura\nTexto.'
    expect(formatar(texto, 12, 12, '# ').texto).toBe('# Termo\n\n# Assinatura\nTexto.')
    expect(formatar(texto, 2, 2, '## ').texto).toBe('## Termo\n\n## Assinatura\nTexto.')
  })

  it('lista vale para todas as linhas selecionadas', () => {
    const result = formatar('um\ndois\ntrês', 1, 6, '- ')
    expect(result.texto).toBe('- um\n- dois\ntrês')
    expect(result.start).toBe(result.end)
    expect(result.start).toBe(11)
  })

  it('cursor no começo, antes de uma linha vazia', () => {
    expect(formatar('\nTexto', 0, 0, '# ').texto).toBe('# \nTexto')
  })

  it('texto vazio vira uma linha com o prefixo', () => {
    expect(formatar('', 0, 0, '# ')).toEqual({ texto: '# ', start: 2, end: 2 })
  })
})
