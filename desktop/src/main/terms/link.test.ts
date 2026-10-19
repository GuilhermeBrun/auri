import { describe, expect, it } from 'vite-plus/test'
import {
  LIMITE_IDA,
  LinkInvalido,
  LinkLongo,
  lerIda,
  montarVolta,
  type Resposta
} from '../../../../web/contrato/assinatura/formato'
import {
  CPF_FICTICIO,
  assinaturaFicticia,
  termoFicticio
} from '../../../../web/contrato/assinatura/ficticio'
import { simplificar, TOLERANCIAS } from '../../../../web/contrato/assinatura/traco'
import { lerVolta, montarIda, novaChave, novoEnvio, sha256 } from './link'

const termo = termoFicticio({ id: novoEnvio() })

function resposta(over: Partial<Resposta> = {}): Resposta {
  return {
    id: termo.id,
    h: sha256(termo.txt),
    nome: 'Maria Fictícia',
    cpf: CPF_FICTICIO,
    rel: 'mae',
    ok: true,
    em: 1_792_000_000,
    tz: -240,
    ...over
  }
}

describe('link do termo no main', () => {
  it('a página lê o link de ida montado pelo Auri', async () => {
    const chave = novaChave()
    const link = montarIda(termo, chave)
    expect(link.startsWith('https://auri.dev.br/assinar#1.')).toBe(true)
    const lido = await lerIda(link.slice(link.indexOf('#')))
    expect(lido.termo).toEqual(termo)
    expect(Buffer.from(lido.chave).equals(chave)).toBe(true)
  })

  it('o Auri lê a resposta montada pela página', async () => {
    const chave = novaChave()
    const assinatura = assinaturaFicticia()
    const volta = await montarVolta(chave, resposta(), assinatura)
    const lida = lerVolta(volta.slice(volta.indexOf('#') + 1), chave)
    expect(lida.resposta).toEqual(resposta())
    expect(lida.assinatura).toEqual(assinatura.map((t) => simplificar(t, TOLERANCIAS[0])))
  })

  it('recusa chave errada, resposta cortada e resposta de outro envio', async () => {
    const chave = novaChave()
    const volta = await montarVolta(chave, resposta(), assinaturaFicticia())
    const fragmento = volta.slice(volta.indexOf('#') + 1)
    expect(() => lerVolta(fragmento, novaChave())).toThrow(LinkInvalido)
    expect(() => lerVolta(fragmento.slice(0, -10), chave)).toThrow(LinkInvalido)
    const [versao, , dados] = fragmento.split('.')
    expect(() => lerVolta(`${versao}.${novoEnvio()}.${dados}`, chave)).toThrow(LinkInvalido)
  })

  it('não monta link acima do limite', () => {
    const longo = termoFicticio({ id: novoEnvio(), txt: 'x'.repeat(15_000) })
    expect(() => montarIda(longo, novaChave(), 200)).toThrow(LinkLongo)
    expect(montarIda(longo, novaChave()).length).toBeLessThanOrEqual(LIMITE_IDA)
  })

  it('o hash bate com o da página', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
