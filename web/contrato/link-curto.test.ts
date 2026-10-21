import { describe, expect, it, vi } from 'vite-plus/test'
import { deBase64url, paraBase64url } from './assinatura/base64url'
import { partes } from './assinatura/formato'
import {
  LinkSumiu,
  SemConexao,
  buscarGuardado,
  chaveDoCodigo,
  codigoDoFragmento,
  ehCodigo,
  encurtarVolta,
  expandirIda,
  guardadoDaIda,
  guardar,
  idNoServidor,
  novoCodigo,
  type Buscar
} from './link-curto'
import contrato from './link-curto.json'

const ORIGEM = 'https://auri.dev.br'
const CODIGO = 'AAECAwQFBgcICQoLDA0ODw'

function servidor() {
  const guardados = new Map<string, string>()
  const buscar = vi.fn<Buscar>(async (endereco, opcoes) => {
    const id = new URL(endereco).searchParams.get('id') ?? ''
    if (opcoes?.method === 'PUT') {
      const { dados } = JSON.parse(opcoes.body as string) as { dados: string }
      guardados.set(id, dados)
      return new Response(null, { status: 204 })
    }
    const dados = guardados.get(id)
    return dados ? new Response(dados) : new Response(null, { status: 404 })
  })
  return { guardados, buscar }
}

describe('link curto', () => {
  it('código tem 16 bytes em base64url; fragmento longo não é código', () => {
    expect(ehCodigo(novoCodigo())).toBe(true)
    expect(deBase64url(novoCodigo())).toHaveLength(16)
    expect(codigoDoFragmento(`#${CODIGO}`)).toBe(CODIGO)
    expect(codigoDoFragmento('#1.abc.def')).toBeNull()
    expect(ehCodigo('a'.repeat(21))).toBe(false)
    expect(ehCodigo('A'.repeat(21) + 'B')).toBe(false)
  })

  it('id no servidor e chave saem do código e não se confundem', async () => {
    const id = await idNoServidor(CODIGO)
    expect(id).toHaveLength(contrato.tamanhoDoId)
    expect(id).toBe(await idNoServidor(CODIGO))
    const chave = await chaveDoCodigo(CODIGO)
    expect(chave).toHaveLength(32)
    expect(paraBase64url(chave)).not.toBe(id)
    expect(await idNoServidor(novoCodigo())).not.toBe(id)
  })

  it('guarda a ida sem a chave e devolve com a chave tirada do código', async () => {
    const { guardados, buscar } = servidor()
    const guardado = guardadoDaIda('1.chave-que-nao-vai.dados-cifrados')
    expect(guardado).toBe('1.dados-cifrados')
    await guardar(CODIGO, guardado, 2_000_000_000, { origem: ORIGEM, buscar })
    expect([...guardados.keys()]).toEqual([await idNoServidor(CODIGO)])
    const chave = paraBase64url(await chaveDoCodigo(CODIGO))
    expect(await expandirIda(CODIGO, { origem: ORIGEM, buscar })).toBe(`1.${chave}.dados-cifrados`)
    expect(buscar.mock.calls[0]![0]).toBe(
      `${ORIGEM}${contrato.caminho}?id=${await idNoServidor(CODIGO)}`
    )
  })

  it('a ida guardada mantém a versão em que foi feita', async () => {
    const { buscar } = servidor()
    await guardar(CODIGO, guardadoDaIda('7.chave.dados'), 2_000_000_000, { origem: ORIGEM, buscar })
    const fragmento = await expandirIda(CODIGO, { origem: ORIGEM, buscar })
    expect(fragmento.split('.')[0]).toBe('7')
    expect(() => partes(fragmento)).toThrow('Versão desconhecida')
  })

  it('a volta vira um link curto que devolve o fragmento longo', async () => {
    const { buscar } = servidor()
    const longo = `${ORIGEM}/recebido#1.AAECAwQFBgcICQoLDA0ODw.cifrado`
    const curto = await encurtarVolta(longo, Date.now(), { origem: ORIGEM, buscar })
    expect(curto).toMatch(/^https:\/\/auri\.dev\.br\/recebido#[\w-]{22}$/)
    const codigo = codigoDoFragmento(curto.slice(curto.indexOf('#')))!
    expect(await buscarGuardado(codigo, { origem: ORIGEM, buscar })).toBe(
      '1.AAECAwQFBgcICQoLDA0ODw.cifrado'
    )
    const { expira } = JSON.parse(buscar.mock.calls[0]![1]!.body as string) as { expira: number }
    expect(expira - Math.floor(Date.now() / 1000)).toBeCloseTo(contrato.vidaDaVoltaS, -1)
  })

  it('separa link que sumiu de falta de conexão', async () => {
    const { buscar } = servidor()
    await expect(buscarGuardado(CODIGO, { origem: ORIGEM, buscar })).rejects.toBeInstanceOf(
      LinkSumiu
    )
    const fora: Buscar = () => Promise.reject(new TypeError('Failed to fetch'))
    await expect(buscarGuardado(CODIGO, { origem: ORIGEM, buscar: fora })).rejects.toBeInstanceOf(
      SemConexao
    )
    const erro: Buscar = async () => new Response(null, { status: 503 })
    await expect(guardar(CODIGO, 'x', 1, { origem: ORIGEM, buscar: erro })).rejects.toBeInstanceOf(
      SemConexao
    )
  })
})
