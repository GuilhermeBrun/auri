import { describe, expect, test } from 'vite-plus/test'
import { novaChave, sha256 } from '../../contrato/assinatura/cifra'
import { CPF_FICTICIO, assinaturaFicticia, termoFicticio } from '../../contrato/assinatura/ficticio'
import { lerVolta, montarIda, montarVolta, type Termo } from '../../contrato/assinatura/formato'
import { simplificar } from '../../contrato/assinatura/traco'
import {
  chaveDoCodigo,
  guardadoDaIda,
  guardar,
  novoCodigo,
  type Buscar
} from '../../contrato/link-curto'
import { abrir, avaliarRecebido, guardarRascunho, lerRascunho, temSuporte } from './estado'
import { resposta, type Preenchido } from './textos'

function memoria(): Pick<Storage, 'getItem' | 'setItem'> & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, valor)
  }
}

const ANTES_DO_PRAZO = Date.UTC(2026, 9, 20)

async function link(termo: Termo = termoFicticio()) {
  const chave = novaChave()
  const ida = await montarIda(termo, chave)
  return { chave, fragmento: ida.slice(ida.indexOf('#')) }
}

const preenchido: Preenchido = {
  nome: 'Maria Fictícia',
  cpf: CPF_FICTICIO,
  rel: 'mae',
  aceite: true,
  tracos: assinaturaFicticia()
}

describe('abrir o link de ida', () => {
  test('decifra o termo e calcula o SHA-256 do texto mostrado', async () => {
    const { chave, fragmento } = await link()
    const estado = await abrir(fragmento, memoria(), ANTES_DO_PRAZO)
    expect(estado).toEqual({
      tela: 'termo',
      aberto: { termo: termoFicticio(), chave, h: await sha256(termoFicticio().txt) },
      rascunho: null
    })
  })

  test('link incompleto, vazio ou de versão desconhecida', async () => {
    const { fragmento } = await link()
    expect(await abrir(fragmento.slice(0, -20), memoria(), ANTES_DO_PRAZO)).toEqual({
      tela: 'incompleto'
    })
    expect(await abrir('', memoria(), ANTES_DO_PRAZO)).toEqual({ tela: 'incompleto' })
    expect(await abrir(fragmento.replace('#1.', '#2.'), memoria(), ANTES_DO_PRAZO)).toEqual({
      tela: 'versao'
    })
  })

  test('link vencido pelo relógio do celular', async () => {
    const { fragmento } = await link()
    const depois = (termoFicticio().ate + 1) * 1000
    expect(await abrir(fragmento, memoria(), depois)).toEqual({
      tela: 'vencido',
      termo: termoFicticio()
    })
  })

  test('navegador sem WebCrypto ou sem CompressionStream', async () => {
    const { fragmento } = await link()
    const semCompressao = { crypto: globalThis.crypto }
    const semCifra = { CompressionStream: 1, DecompressionStream: 1 }
    expect(await abrir(fragmento, memoria(), ANTES_DO_PRAZO, semCompressao)).toEqual({
      tela: 'sem-suporte'
    })
    expect(temSuporte(semCifra)).toBe(false)
    expect(temSuporte()).toBe(true)
  })

  test('já enviado volta à tela final, mesmo depois do prazo', async () => {
    const { fragmento } = await link()
    const armazenamento = memoria()
    guardarRascunho(termoFicticio().id, { enviado: 'mensagem' }, armazenamento)
    expect(await abrir(fragmento, armazenamento, Date.UTC(2030, 0))).toEqual({
      tela: 'enviado',
      termo: termoFicticio(),
      mensagem: 'mensagem'
    })
  })

  test('o preenchido volta do sessionStorage', async () => {
    const { fragmento } = await link()
    const armazenamento = memoria()
    guardarRascunho(termoFicticio().id, { preenchido }, armazenamento)
    const estado = await abrir(fragmento, armazenamento, ANTES_DO_PRAZO)
    expect(estado).toMatchObject({ tela: 'termo', rascunho: preenchido })
  })

  test('quem assina volta ao papel do link se o guardado não vale para este termo', async () => {
    const { fragmento } = await link()
    const armazenamento = memoria()
    const outro: Preenchido = { ...preenchido, rel: 'paciente' }
    guardarRascunho(termoFicticio().id, { preenchido: outro }, armazenamento)
    const estado = await abrir(fragmento, armazenamento, ANTES_DO_PRAZO)
    expect(estado).toMatchObject({ tela: 'termo', rascunho: { rel: 'mae' } })
  })
})

function servidor() {
  const guardados = new Map<string, string>()
  const buscar: Buscar = async (endereco, opcoes) => {
    const id = new URL(endereco).searchParams.get('id') ?? ''
    if (opcoes?.method === 'PUT') {
      guardados.set(id, (JSON.parse(opcoes.body as string) as { dados: string }).dados)
      return new Response(null, { status: 204 })
    }
    const dados = guardados.get(id)
    return dados ? new Response(dados) : new Response(null, { status: 404 })
  }
  return { origem: 'https://auri.dev.br', buscar }
}

describe('link curto', () => {
  test('busca o termo cifrado pelo código e abre com a chave do código', async () => {
    const rede = servidor()
    const codigo = novoCodigo()
    const chave = await chaveDoCodigo(codigo)
    const ida = await montarIda(termoFicticio(), chave)
    await guardar(codigo, guardadoDaIda(ida.slice(ida.indexOf('#') + 1)), 2_000_000_000, rede)
    const estado = await abrir(`#${codigo}`, memoria(), ANTES_DO_PRAZO, globalThis, rede)
    expect(estado).toMatchObject({ tela: 'termo', aberto: { termo: termoFicticio(), chave } })
  })

  test('código que não está no site vira "não vale mais"; sem rede, "sem internet"', async () => {
    const codigo = novoCodigo()
    expect(await abrir(`#${codigo}`, memoria(), ANTES_DO_PRAZO, globalThis, servidor())).toEqual({
      tela: 'sumiu'
    })
    const fora = { origem: 'https://auri.dev.br', buscar: () => Promise.reject(new TypeError()) }
    expect(await abrir(`#${codigo}`, memoria(), ANTES_DO_PRAZO, globalThis, fora)).toEqual({
      tela: 'sem-conexao'
    })
  })

  test('a página recebido aceita o código da resposta guardada', () => {
    expect(avaliarRecebido(`#${novoCodigo()}`)).toBe('pronto')
  })
})

describe('rascunho', () => {
  test('ignora o que não é um preenchido válido', () => {
    const armazenamento = memoria()
    const id = termoFicticio().id
    const casos = [
      'não é json',
      '{"preenchido":{"nome":1}}',
      JSON.stringify({ preenchido: { ...preenchido, cpf: '123.456' } }),
      JSON.stringify({ preenchido: { ...preenchido, tracos: [[[2000, 0]]] } }),
      JSON.stringify({ preenchido: { ...preenchido, tracos: [['ab']] } }),
      JSON.stringify({ enviado: 1 })
    ]
    for (const caso of casos) {
      armazenamento.dados.set(`auri-termo-${id}`, caso)
      expect(lerRascunho(id, armazenamento)).toBeNull()
    }
  })

  test('sem sessionStorage, segue sem guardar', () => {
    const quebrado = {
      getItem: (): string | null => {
        throw new Error('bloqueado')
      },
      setItem: (): void => {
        throw new Error('bloqueado')
      }
    }
    expect(() => guardarRascunho('x', { enviado: 'm' }, quebrado)).not.toThrow()
    expect(lerRascunho('x', quebrado)).toBeNull()
    expect(lerRascunho('x')).toBeNull()
  })
})

describe('resposta montada pela página', () => {
  test('o Auri lê o que a página montou', async () => {
    const { chave, fragmento } = await link()
    const estado = await abrir(fragmento, memoria(), ANTES_DO_PRAZO)
    if (estado.tela !== 'termo') throw new Error(estado.tela)
    const { termo, h } = estado.aberto
    const dados = resposta(termo, h, preenchido, new Date(ANTES_DO_PRAZO))
    const volta = await montarVolta(chave, dados, preenchido.tracos)
    const lida = await lerVolta(volta.slice(volta.indexOf('#')), chave)
    expect(lida.resposta).toEqual(dados)
    expect(lida.resposta.h).toBe(await sha256(termoFicticio().txt))
    expect(lida.assinatura).toEqual(preenchido.tracos.map((traco) => simplificar(traco)))
  })
})

describe('página recebido', () => {
  test('confere só o formato, sem a chave', async () => {
    const volta = await montarVolta(
      novaChave(),
      resposta(termoFicticio(), 'a'.repeat(64), preenchido, new Date()),
      preenchido.tracos
    )
    const fragmento = volta.slice(volta.indexOf('#'))
    expect(avaliarRecebido(fragmento)).toBe('pronto')
    expect(avaliarRecebido(fragmento.slice(0, 40))).toBe('incompleto')
    expect(avaliarRecebido('')).toBe('incompleto')
    expect(avaliarRecebido(fragmento.replace('#1.', '#3.'))).toBe('versao')
  })
})
