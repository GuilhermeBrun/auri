import { describe, expect, test } from 'vite-plus/test'
import { lerConteudo } from './conteudo'
import { TEXTO_FICTICIO } from './ficticio'

const simples = (texto: string) => [{ texto, negrito: false }]

describe('conteúdo do termo', () => {
  test('parágrafos separados por linha em branco; a quebra simples continua no parágrafo', () => {
    expect(lerConteudo('Primeiro parágrafo.\n\nSegundo,\ncom duas linhas.')).toEqual([
      { tipo: 'paragrafo', trechos: simples('Primeiro parágrafo.') },
      { tipo: 'paragrafo', trechos: simples('Segundo,\ncom duas linhas.') }
    ])
  })

  test('títulos de dois níveis; o terceiro nível é texto', () => {
    expect(lerConteudo('# Termo\n## 1. Do atendimento\n### Nota')).toEqual([
      { tipo: 'titulo', nivel: 1, trechos: simples('Termo') },
      { tipo: 'titulo', nivel: 2, trechos: simples('1. Do atendimento') },
      { tipo: 'paragrafo', trechos: simples('### Nota') }
    ])
  })

  test('lista com hífen ou marcador; texto depois da lista abre outro parágrafo', () => {
    expect(lerConteudo('Inclui:\n- avaliação\n• terapia\nE mais nada.')).toEqual([
      { tipo: 'paragrafo', trechos: simples('Inclui:') },
      { tipo: 'lista', itens: [simples('avaliação'), simples('terapia')] },
      { tipo: 'paragrafo', trechos: simples('E mais nada.') }
    ])
  })

  test('negrito entre pares de asteriscos, também na lista e no título', () => {
    expect(lerConteudo('Avisar com **24 horas** de antecedência.')).toEqual([
      {
        tipo: 'paragrafo',
        trechos: [
          { texto: 'Avisar com ', negrito: false },
          { texto: '24 horas', negrito: true },
          { texto: ' de antecedência.', negrito: false }
        ]
      }
    ])
    expect(lerConteudo('- **tudo**')).toEqual([
      { tipo: 'lista', itens: [[{ texto: 'tudo', negrito: true }]] }
    ])
    expect(lerConteudo('## **Importante**')).toEqual([
      { tipo: 'titulo', nivel: 2, trechos: [{ texto: 'Importante', negrito: true }] }
    ])
  })

  test('asteriscos sem par ficam como texto', () => {
    expect(lerConteudo('a **b** c **d')).toEqual([
      {
        tipo: 'paragrafo',
        trechos: [
          { texto: 'a ', negrito: false },
          { texto: 'b', negrito: true },
          { texto: ' c **d', negrito: false }
        ]
      }
    ])
  })

  test('nunca interpreta HTML', () => {
    expect(lerConteudo('<b>oi</b> <script>alert(1)</script>')).toEqual([
      { tipo: 'paragrafo', trechos: simples('<b>oi</b> <script>alert(1)</script>') }
    ])
  })

  test('ignora espaços nas pontas, quebras do Windows e blocos sem texto', () => {
    expect(lerConteudo('  \r\n  Texto  \r\n\r\n**** \r\n\r\n-  ****\r\n## **** \r\n')).toEqual([
      { tipo: 'paragrafo', trechos: simples('Texto') }
    ])
    expect(lerConteudo('#\n-')).toEqual([{ tipo: 'paragrafo', trechos: simples('#\n-') }])
    expect(lerConteudo('   \n\n ')).toEqual([])
  })

  test('o termo fictício tem título, seções, lista e negrito', () => {
    const blocos = lerConteudo(TEXTO_FICTICIO)
    expect(blocos.filter((bloco) => bloco.tipo === 'titulo')).toHaveLength(6)
    expect(blocos.find((bloco) => bloco.tipo === 'lista')).toMatchObject({
      itens: { length: 3 }
    })
  })
})
