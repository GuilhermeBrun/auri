import { describe, expect, it } from 'vite-plus/test'
import { termoFicticio } from '../../../../web/contrato/assinatura/ficticio'
import { LinkInvalido, LinkLongo } from '../../../../web/contrato/assinatura/formato'
import { confirmacaoFicticia, ENVIO_FICTICIO } from '../../../../web/contrato/confirmacao/ficticio'
import {
  LIMITE_IDA,
  lerIda,
  montarVolta,
  type Resposta
} from '../../../../web/contrato/confirmacao/formato'
import { montarIda as montarIdaDoTermo, novaChave, novoEnvio } from '../terms/link'
import { lerVolta, montarIda } from './link'

const confirmacao = confirmacaoFicticia({ id: novoEnvio() })

const resposta = (over: Partial<Resposta> = {}): Resposta => ({
  id: confirmacao.id,
  res: 'confirmada',
  em: ENVIO_FICTICIO + 900,
  tz: -240,
  ...over
})

const fragmento = (link: string): string => link.slice(link.indexOf('#') + 1)

describe('link da confirmação no main', () => {
  it('a página lê o link de ida montado pelo Auri', async () => {
    const chave = novaChave()
    const link = montarIda(confirmacao, chave)
    expect(link.startsWith('https://auri.dev.br/confirmar#1.')).toBe(true)
    expect(link.length).toBeLessThanOrEqual(LIMITE_IDA)
    const lido = await lerIda(link.slice(link.indexOf('#')))
    expect(lido.confirmacao).toEqual(confirmacao)
    expect(Buffer.from(lido.chave).equals(chave)).toBe(true)
  })

  it('o Auri lê as duas respostas montadas pela página', async () => {
    const chave = novaChave()
    for (const res of ['confirmada', 'desmarcada'] as const) {
      const volta = await montarVolta(chave, resposta({ res }))
      expect(lerVolta(fragmento(volta), chave)).toEqual(resposta({ res }))
    }
  })

  it('recusa chave errada, resposta cortada, de outro envio e de termo', async () => {
    const chave = novaChave()
    const volta = fragmento(await montarVolta(chave, resposta()))
    expect(() => lerVolta(volta, novaChave())).toThrow(LinkInvalido)
    expect(() => lerVolta(volta.slice(0, -6), chave)).toThrow(LinkInvalido)
    const [versao, , dados] = volta.split('.')
    expect(() => lerVolta(`${versao}.${novoEnvio()}.${dados}`, chave)).toThrow(LinkInvalido)
    expect(() => lerVolta(volta.replace(/^1/, '3'), chave)).toThrow(
      expect.objectContaining({ motivo: 'versao' })
    )
  })

  it('a página não aceita um link de termo como confirmação', async () => {
    const termo = montarIdaDoTermo(termoFicticio({ id: novoEnvio() }), novaChave())
    await expect(lerIda(termo.slice(termo.indexOf('#')))).rejects.toThrow(LinkInvalido)
  })

  it('valida antes de montar e respeita o limite', () => {
    expect(() => montarIda({ ...confirmacao, ate: confirmacao.ses.ini + 60 }, novaChave())).toThrow(
      TypeError
    )
    expect(() => montarIda(confirmacao, novaChave(), 100)).toThrow(LinkLongo)
  })
})
