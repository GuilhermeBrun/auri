import { describe, expect, test } from 'vite-plus/test'
import { novaChave } from '../../contrato/assinatura/cifra'
import { confirmacaoFicticia, ENVIO_FICTICIO } from '../../contrato/confirmacao/ficticio'
import { lerVolta, montarIda, montarVolta } from '../../contrato/confirmacao/formato'
import {
  abrir,
  avaliarResposta,
  guardarEnviado,
  lerEnviado,
  mesmoFuso,
  respostaDe,
  situacao
} from './estado'

function memoria(): Pick<Storage, 'getItem' | 'setItem'> {
  const dados = new Map<string, string>()
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, valor)
  }
}

const confirmacao = confirmacaoFicticia()
const NO_PRAZO = (ENVIO_FICTICIO + 600) * 1000

async function link() {
  const chave = novaChave()
  const ida = await montarIda(confirmacao, chave)
  return { chave, fragmento: ida.slice(ida.indexOf('#')) }
}

describe('abrir o link de confirmação', () => {
  test('decifra e mostra a pergunta dentro do prazo', async () => {
    const { chave, fragmento } = await link()
    expect(await abrir(fragmento, memoria(), NO_PRAZO)).toEqual({
      tela: 'pergunta',
      aberta: { confirmacao, chave }
    })
  })

  test('link incompleto, vazio, de versão desconhecida ou sem suporte', async () => {
    const { fragmento } = await link()
    expect(await abrir(fragmento.slice(0, -8), memoria(), NO_PRAZO)).toEqual({
      tela: 'incompleto'
    })
    expect(await abrir('', memoria(), NO_PRAZO)).toEqual({ tela: 'incompleto' })
    expect(await abrir(fragmento.replace('#1.', '#2.'), memoria(), NO_PRAZO)).toEqual({
      tela: 'versao'
    })
    expect(await abrir(fragmento, memoria(), NO_PRAZO, { crypto: globalThis.crypto })).toEqual({
      tela: 'sem-suporte'
    })
  })

  test('prazo vencido e sessão que já passou', async () => {
    const { fragmento } = await link()
    const vencido = (confirmacao.ate + 1) * 1000
    const passou = confirmacao.ses.ini * 1000
    expect(await abrir(fragmento, memoria(), vencido)).toEqual({ tela: 'vencido', confirmacao })
    expect(await abrir(fragmento, memoria(), passou)).toEqual({ tela: 'passou', confirmacao })
    expect(situacao(confirmacao, NO_PRAZO)).toBeNull()
  })

  test('já respondido volta à tela final, mesmo depois do prazo', async () => {
    const { fragmento } = await link()
    const armazenamento = memoria()
    guardarEnviado(confirmacao.id, { res: 'desmarcada', mensagem: 'm' }, armazenamento)
    expect(await abrir(fragmento, armazenamento, (confirmacao.ate + 1) * 1000)).toEqual({
      tela: 'enviado',
      confirmacao,
      res: 'desmarcada',
      mensagem: 'm'
    })
  })

  test('ignora o que estiver estragado no armazenamento', () => {
    const armazenamento = memoria()
    armazenamento.setItem(`auri-confirmacao-${confirmacao.id}`, '{"res":"talvez","mensagem":"m"}')
    expect(lerEnviado(confirmacao.id, armazenamento)).toBeNull()
    armazenamento.setItem(`auri-confirmacao-${confirmacao.id}`, 'não é json')
    expect(lerEnviado(confirmacao.id, armazenamento)).toBeNull()
  })
})

describe('resposta', () => {
  test('leva a decisão, a hora e o fuso do celular e o Auri lê', async () => {
    const chave = novaChave()
    const agora = new Date(NO_PRAZO)
    const resposta = respostaDe(confirmacao, 'confirmada', agora)
    expect(resposta).toEqual({
      id: confirmacao.id,
      res: 'confirmada',
      em: ENVIO_FICTICIO + 600,
      tz: 0 - agora.getTimezoneOffset()
    })
    const volta = await montarVolta(chave, resposta)
    expect(await lerVolta(volta.slice(volta.indexOf('#') + 1), chave)).toEqual(resposta)
    expect(avaliarResposta(volta.slice(volta.indexOf('#')))).toBe('pronto')
  })

  test('formato da volta sem a chave', () => {
    expect(avaliarResposta('#1.curto.abc')).toBe('incompleto')
    expect(avaliarResposta(`#5.${confirmacao.id}.${'A'.repeat(60)}`)).toBe('versao')
  })

  test('fuso do celular diferente do da clínica', () => {
    const agora = new Date()
    expect(mesmoFuso(-agora.getTimezoneOffset(), agora)).toBe(true)
    expect(mesmoFuso(-agora.getTimezoneOffset() + 60, agora)).toBe(false)
  })
})
