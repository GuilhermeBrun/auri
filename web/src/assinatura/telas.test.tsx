import { renderToString } from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'
import { novaChave } from '../../contrato/assinatura/cifra'
import { termoFicticio } from '../../contrato/assinatura/ficticio'
import type { Termo } from '../../contrato/assinatura/formato'
import type { Estado } from './estado'
import { PaginaAssinar } from './PaginaAssinar'
import { PaginaRecebido } from './PaginaRecebido'

const assinar = (estado: Estado) => renderToString(<PaginaAssinar inicial={estado} />)
const comTermo = (termo: Termo = termoFicticio()): Estado => ({
  tela: 'termo',
  aberto: { termo, chave: novaChave(), h: 'a'.repeat(64) },
  rascunho: null
})

describe('página assinar', () => {
  test('mostra clínica, termo, campos, quadro e para onde vai a resposta', () => {
    const html = assinar(comTermo())
    for (const trecho of [
      'Clínica Exemplo',
      'Termo de consentimento',
      'Ana Beatriz Fictícia',
      '04/03/2019',
      'Versão <!-- -->3',
      '<strong>24 horas</strong>',
      '<li>avaliação, com entrevista e testes adequados à idade;</li>',
      'Fernanda Exemplo · CRFa 5-00000',
      'Nome completo',
      'Quem assina',
      'Quadro de assinatura, vazio',
      '<strong>Clínica Exemplo</strong>',
      '(65) 99999-0000',
      'Falta nome completo, CPF, marcar o aceite e assinar.'
    ]) {
      expect(html).toContain(trecho)
    }
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*?Enviar pelo WhatsApp/)
    expect(html).not.toContain('wa.me')
  })

  test('o texto da clínica nunca vira HTML', () => {
    const html = assinar(comTermo(termoFicticio({ txt: '<img src=x onerror=alert(1)> **ok**' })))
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; <strong>ok</strong>')
    expect(html).not.toContain('<img')
  })

  test('estados de erro', () => {
    expect(assinar({ tela: 'abrindo' })).toContain('Abrindo o termo…')
    expect(assinar({ tela: 'incompleto' })).toContain('Este link está incompleto')
    expect(assinar({ tela: 'versao' })).toContain('Atualize a página')
    expect(assinar({ tela: 'sem-suporte' })).toContain('Abra o link em outro navegador ou aparelho')
    const vencido = assinar({ tela: 'vencido', termo: termoFicticio() })
    expect(vencido).toContain('Este link venceu')
    expect(vencido).toContain('href="https://wa.me/5565999990000"')
  })

  test('tela final reabre o WhatsApp com a mesma mensagem', () => {
    const mensagem = 'Termo assinado\nhttps://auri.dev.br/recebido#1.a.b'
    const html = assinar({ tela: 'enviado', termo: termoFicticio(), mensagem })
    expect(html).toContain('Falta um toque')
    expect(html).toContain(
      `href="https://wa.me/5565999990000?text=${encodeURIComponent(mensagem)}"`
    )
    expect(html).toContain('Copiar mensagem')
  })
})

describe('página recebido', () => {
  const recebido = (fragmento: string) =>
    renderToString(
      <PaginaRecebido
        pagina={{ endereco: `https://auri.dev.br/recebido${fragmento}`, fragmento }}
      />
    )

  test('resposta no formato certo: só oferece copiar', () => {
    const html = recebido(`#1.AAECAwQFBgcICQoLDA0ODw.${'A'.repeat(60)}`)
    expect(html).toContain('Resposta do termo assinado')
    expect(html).toContain('Copiar resposta')
    expect(html).not.toContain('auri://')
  })

  test('resposta incompleta ou de versão desconhecida', () => {
    expect(recebido('#1.curto.abc')).toContain('Esta resposta está incompleta')
    expect(recebido(`#9.AAECAwQFBgcICQoLDA0ODw.${'A'.repeat(60)}`)).toContain('Atualize a página')
  })
})
