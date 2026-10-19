import { describe, expect, test } from 'vite-plus/test'
import { paraBase64url } from '../assinatura/base64url'
import { cifrar, novaChave } from '../assinatura/cifra'
import { comprimir } from '../assinatura/compressao'
import { LinkInvalido, LinkLongo, novoId } from '../assinatura/formato'
import { confirmacaoFicticia, ENVIO_FICTICIO, INICIO_FICTICIO } from './ficticio'
import {
  DADO_DA_IDA,
  LIMITE_IDA,
  LIMITE_VOLTA,
  confirmacaoValida,
  dadoDaVolta,
  fragmentoDaVolta,
  idDaVolta,
  lerIda,
  lerVolta,
  montarIda,
  montarVolta,
  passou,
  respostaValida,
  venceu,
  type Resposta
} from './formato'

const fragmento = (link: string): string => link.slice(link.indexOf('#') + 1)

const resposta = (mudancas: Partial<Resposta> = {}): Resposta => ({
  id: confirmacaoFicticia().id,
  res: 'confirmada',
  em: ENVIO_FICTICIO + 600,
  tz: -240,
  ...mudancas
})

describe('ida', () => {
  test('monta e lê de volta, dentro do limite', async () => {
    const chave = novaChave()
    const confirmacao = confirmacaoFicticia({ id: novoId() })
    const link = await montarIda(confirmacao, chave)
    expect(link.startsWith('https://auri.dev.br/confirmar#1.')).toBe(true)
    expect(link.length).toBeLessThan(LIMITE_IDA)
    const lido = await lerIda(fragmento(link))
    expect(lido.confirmacao).toEqual(confirmacao)
    expect(lido.chave).toEqual(chave)
  })

  test('com os campos no tamanho máximo ainda cabe', async () => {
    const confirmacao = confirmacaoFicticia({
      cli: { nome: 'C'.repeat(80), whats: '5'.repeat(15) },
      pac: { nome: 'P'.repeat(120) },
      ses: { ini: INICIO_FICTICIO, dur: 600, prof: 'F'.repeat(120) }
    })
    const link = await montarIda(confirmacao, novaChave())
    expect(link.length).toBeLessThanOrEqual(LIMITE_IDA)
  })

  test('aceita o # no começo e outra origem', async () => {
    const link = await montarIda(confirmacaoFicticia(), novaChave(), {
      origem: 'http://localhost:4173'
    })
    expect(link.startsWith('http://localhost:4173/confirmar#')).toBe(true)
    await expect(lerIda(link.slice(link.indexOf('#')))).resolves.toBeDefined()
  })

  test('recusa link acima do limite', async () => {
    await expect(montarIda(confirmacaoFicticia(), novaChave(), { limite: 100 })).rejects.toThrow(
      LinkLongo
    )
  })

  test('versão desconhecida, link cortado ou de termo', async () => {
    const link = fragmento(await montarIda(confirmacaoFicticia(), novaChave()))
    await expect(lerIda(link.replace(/^1/, '2'))).rejects.toMatchObject({ motivo: 'versao' })
    await expect(lerIda(link.slice(0, -4))).rejects.toMatchObject({ motivo: 'incompleto' })
    const chave = novaChave()
    const termo = await cifrar(chave, 'auri/termo/1/ida', await comprimir(new Uint8Array([1])))
    await expect(lerIda(`1.${paraBase64url(chave)}.${paraBase64url(termo)}`)).rejects.toThrow(
      LinkInvalido
    )
  })

  test('valida cada campo', () => {
    const certa = confirmacaoFicticia()
    expect(confirmacaoValida({ ...certa, extra: 1 })).toEqual(certa)
    for (const errada of [
      { ...certa, id: 'curto' },
      { ...certa, cob: 'sim' },
      { ...certa, tz: 900 },
      { ...certa, ate: certa.ses.ini + 1 },
      { ...certa, cli: { ...certa.cli, whats: '+55 65' } },
      { ...certa, pac: { nome: ' ' } },
      { ...certa, ses: { ...certa.ses, dur: 0 } },
      { ...certa, ses: { ...certa.ses, prof: '' } },
      { ...certa, ses: undefined }
    ]) {
      expect(() => confirmacaoValida(errada)).toThrow(TypeError)
    }
  })

  test('prazo e sessão que já passou', () => {
    const confirmacao = confirmacaoFicticia()
    expect(venceu(confirmacao, confirmacao.ate * 1000)).toBe(false)
    expect(venceu(confirmacao, confirmacao.ate * 1000 + 1000)).toBe(true)
    expect(passou(confirmacao, confirmacao.ses.ini * 1000 - 1)).toBe(false)
    expect(passou(confirmacao, confirmacao.ses.ini * 1000)).toBe(true)
  })
})

describe('volta', () => {
  test('monta e lê com a chave da ida', async () => {
    const chave = novaChave()
    for (const res of ['confirmada', 'desmarcada'] as const) {
      const link = await montarVolta(chave, resposta({ res }))
      expect(link.startsWith('https://auri.dev.br/resposta#1.AAECAwQFBgcICQoLDA0ODw.')).toBe(true)
      expect(link.length).toBeLessThan(LIMITE_VOLTA)
      expect(await lerVolta(fragmento(link), chave)).toEqual(resposta({ res }))
    }
  })

  test('recusa chave errada, id trocado e resposta de termo', async () => {
    const chave = novaChave()
    const link = fragmento(await montarVolta(chave, resposta()))
    await expect(lerVolta(link, novaChave())).rejects.toThrow(LinkInvalido)
    const [, , dados] = link.split('.')
    await expect(lerVolta(`1.${novoId()}.${dados}`, chave)).rejects.toThrow(LinkInvalido)
    const id = resposta().id
    const outro = await cifrar(chave, `auri/termo/1/volta/${id}`, await comprimir(new Uint8Array()))
    await expect(lerVolta(`1.${id}.${paraBase64url(outro)}`, chave)).rejects.toThrow(LinkInvalido)
  })

  test('id de dentro tem de ser o de fora', async () => {
    const chave = novaChave()
    const id = novoId()
    const corpo = new TextEncoder().encode(JSON.stringify(resposta()))
    const dados = await cifrar(chave, dadoDaVolta(id), await comprimir(corpo))
    await expect(lerVolta(`1.${id}.${paraBase64url(dados)}`, chave)).rejects.toThrow(LinkInvalido)
  })

  test('o formato se confere sem a chave', async () => {
    const link = fragmento(await montarVolta(novaChave(), resposta()))
    expect(idDaVolta(link)).toBe(resposta().id)
    expect(() => idDaVolta('1.curto.abc')).toThrow(LinkInvalido)
    expect(() => idDaVolta(`1.${resposta().id}.AAAA`)).toThrow(LinkInvalido)
    expect(() => idDaVolta(link.replace(/^1/, '7'))).toThrow(
      expect.objectContaining({ motivo: 'versao' })
    )
  })

  test('valida a resposta', () => {
    expect(respostaValida(resposta())).toEqual(resposta())
    expect(() => respostaValida({ ...resposta(), res: 'talvez' })).toThrow(TypeError)
    expect(() => respostaValida({ ...resposta(), em: -1 })).toThrow(TypeError)
    expect(() => respostaValida({ ...resposta(), tz: 0.5 })).toThrow(TypeError)
  })

  test('acha a resposta na mensagem do WhatsApp', () => {
    const f = `1.${resposta().id}.abc-_123`
    expect(fragmentoDaVolta(`Sessão confirmada: Ana\nhttps://auri.dev.br/resposta#${f}`)).toBe(f)
    expect(fragmentoDaVolta(`https://auri.dev.br/resposta/#${f}`)).toBe(f)
    expect(fragmentoDaVolta(` ${f} `)).toBe(f)
    expect(fragmentoDaVolta('Sessão confirmada, sem link')).toBeNull()
  })

  test('os dados adicionais são diferentes dos do termo', () => {
    expect(DADO_DA_IDA).toBe('auri/confirmacao/1/ida')
    expect(dadoDaVolta('x')).toBe('auri/confirmacao/1/volta/x')
  })
})
