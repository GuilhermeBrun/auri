import { renderToString } from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'
import { novaChave } from '../../contrato/assinatura/cifra'
import { confirmacaoFicticia } from '../../contrato/confirmacao/ficticio'
import type { Estado } from './estado'
import { PaginaConfirmar } from './PaginaConfirmar'
import { PaginaResposta } from './PaginaResposta'

const confirmar = (estado: Estado) => renderToString(<PaginaConfirmar inicial={estado} />)
const confirmacao = confirmacaoFicticia()

describe('página confirmar', () => {
  test('mostra clínica, sessão, prazo, política e as duas respostas', () => {
    const html = confirmar({ tela: 'pergunta', aberta: { confirmacao, chave: novaChave() } })
    for (const trecho of [
      'Clínica Exemplo',
      'Confirme a sessão',
      'Quinta-feira, 22 de outubro',
      '14:00 às 14:50',
      'Ana Beatriz<!-- --> · com <!-- -->Fernanda',
      'Responda <!-- -->até',
      'o horário fica livre para outro paciente e a sessão é cobrada',
      'Confirmar presença',
      'Desmarcar',
      '(65) 99999-0000'
    ]) {
      expect(html).toContain(trecho)
    }
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*?Confirmar presença/)
    expect(html).not.toContain('wa.me')
  })

  test('sem cobrança, o aviso não fala em cobrar', () => {
    const html = confirmar({
      tela: 'pergunta',
      aberta: { confirmacao: confirmacaoFicticia({ cob: false }), chave: novaChave() }
    })
    expect(html).not.toContain('cobrada')
  })

  test('estados de erro e de fim', () => {
    expect(confirmar({ tela: 'abrindo' })).toContain('Abrindo a confirmação…')
    expect(confirmar({ tela: 'incompleto' })).toContain('Este link está incompleto')
    expect(confirmar({ tela: 'versao' })).toContain('Atualize a página')
    expect(confirmar({ tela: 'sem-suporte' })).toContain('responda direto para a clínica')
    const vencido = confirmar({ tela: 'vencido', confirmacao })
    expect(vencido).toContain('Passou o prazo para responder')
    expect(vencido).toContain('21/10<!-- --> às <!-- -->10:30')
    expect(vencido).toContain(
      `href="https://wa.me/5565999990000?text=${encodeURIComponent('Olá! Sobre a sessão de Ana Beatriz, quinta-feira, 22/10, às 14:00: ')}"`
    )
    const passou = confirmar({ tela: 'passou', confirmacao })
    expect(passou).toContain('Esta sessão já passou')
    expect(passou).toContain('href="https://wa.me/5565999990000"')
  })

  test('tela final reabre o WhatsApp com a mesma mensagem', () => {
    const mensagem = 'Sessão desmarcada: Ana\nhttps://auri.dev.br/resposta#1.a.b'
    const html = confirmar({ tela: 'enviado', confirmacao, res: 'desmarcada', mensagem })
    expect(html).toContain('Falta um toque')
    expect(html).toContain('o pedido para desmarcar pronto')
    expect(html).toContain(
      `href="https://wa.me/5565999990000?text=${encodeURIComponent(mensagem)}"`
    )
    const confirmada = confirmar({ tela: 'enviado', confirmacao, res: 'confirmada', mensagem })
    expect(confirmada).toContain('a confirmação pronta')
  })
})

describe('página resposta', () => {
  const fragmento = `#1.${confirmacao.id}.${'A'.repeat(60)}`
  const pagina = { endereco: `https://auri.dev.br/resposta${fragmento}`, fragmento }

  test('no celular, só oferece copiar', () => {
    const html = renderToString(<PaginaResposta pagina={pagina} computador={false} />)
    expect(html).toContain('Resposta da confirmação')
    expect(html).toContain('Copiar resposta')
    expect(html).not.toContain('auri://')
  })

  test('no computador, abre o Auri pela confirmação', () => {
    const html = renderToString(<PaginaResposta pagina={pagina} computador abrir={() => {}} />)
    expect(html).toContain('Abrindo o Auri…')
    expect(html).not.toContain('Copiar resposta')
  })

  test('resposta incompleta ou de versão desconhecida', () => {
    const incompleta = { endereco: '', fragmento: '#1.curto.abc' }
    expect(renderToString(<PaginaResposta pagina={incompleta} computador={false} />)).toContain(
      'Peça para quem respondeu enviar de novo'
    )
    const nova = { endereco: '', fragmento: `#4.${confirmacao.id}.${'A'.repeat(60)}` }
    expect(renderToString(<PaginaResposta pagina={nova} computador={false} />)).toContain(
      'Atualize a página'
    )
  })
})
