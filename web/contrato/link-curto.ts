import { deBase64url, paraBase64url } from './assinatura/base64url'
import contrato from './link-curto.json'

export const TAMANHO_DO_CODIGO = 16
export const ESPERA_MS = 8000
export const { vidaDaVoltaS: VIDA_DA_VOLTA_S, folgaDaIdaS: FOLGA_DA_IDA_S } = contrato
const {
  caminho: CAMINHO_DA_API,
  rotuloDoId: ROTULO_DO_ID,
  rotuloDaChave: ROTULO_DA_CHAVE
} = contrato

export const DADOS_GUARDADOS = new RegExp(`^[\\w.-]{1,${contrato.maximoGuardado}}$`)

export class LinkSumiu extends Error {
  constructor() {
    super('O link expirou ou não existe.')
    this.name = 'LinkSumiu'
  }
}

export class SemConexao extends Error {
  constructor(opcoes?: ErrorOptions) {
    super('Sem conexão com o site do Auri.', opcoes)
    this.name = 'SemConexao'
  }
}

export function ehCodigo(texto: string): boolean {
  if (!/^[\w-]{22}$/.test(texto)) return false
  try {
    return deBase64url(texto).length === TAMANHO_DO_CODIGO
  } catch {
    return false
  }
}

export function codigoDoFragmento(fragmento: string): string | null {
  const limpo = fragmento.replace(/^#/, '')
  return ehCodigo(limpo) ? limpo : null
}

export const novoCodigo = (): string =>
  paraBase64url(crypto.getRandomValues(new Uint8Array(TAMANHO_DO_CODIGO)))

async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
}

export const idNoServidor = async (codigo: string): Promise<string> =>
  paraBase64url(await sha256(ROTULO_DO_ID + codigo))

export const chaveDoCodigo = (codigo: string): Promise<Uint8Array> =>
  sha256(ROTULO_DA_CHAVE + codigo)

export const enderecoNaApi = (origem: string, id: string): string =>
  `${origem}${CAMINHO_DA_API}?id=${id}`

export type Buscar = (endereco: string, opcoes?: RequestInit) => Promise<Response>

type Opcoes = { origem: string; buscar?: Buscar; esperaMs?: number }

async function pedir(endereco: string, init: RequestInit, buscar: Buscar, esperaMs: number) {
  try {
    return await buscar(endereco, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(esperaMs)
    })
  } catch (erro) {
    throw new SemConexao({ cause: erro })
  }
}

export async function guardar(
  codigo: string,
  dados: string,
  expira: number,
  { origem, buscar = fetch, esperaMs = ESPERA_MS }: Opcoes
): Promise<void> {
  if (!DADOS_GUARDADOS.test(dados)) throw new RangeError('Dados fora do formato guardado')
  const resposta = await pedir(
    enderecoNaApi(origem, await idNoServidor(codigo)),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dados, expira })
    },
    buscar,
    esperaMs
  )
  if (!resposta.ok) throw new SemConexao({ cause: new Error(`HTTP ${resposta.status}`) })
}

export async function buscarGuardado(
  codigo: string,
  { origem, buscar = fetch, esperaMs = ESPERA_MS }: Opcoes
): Promise<string> {
  const resposta = await pedir(
    enderecoNaApi(origem, await idNoServidor(codigo)),
    { method: 'GET' },
    buscar,
    esperaMs
  )
  if (resposta.status === 404) throw new LinkSumiu()
  if (!resposta.ok) throw new SemConexao({ cause: new Error(`HTTP ${resposta.status}`) })
  const dados = await resposta.text()
  if (!DADOS_GUARDADOS.test(dados)) throw new LinkSumiu()
  return dados
}

export async function expandirIda(codigo: string, versao: number, opcoes: Opcoes): Promise<string> {
  const [dados, chave] = await Promise.all([buscarGuardado(codigo, opcoes), chaveDoCodigo(codigo)])
  return `${versao}.${paraBase64url(chave)}.${dados}`
}

export function partesDoLink(link: string): { inicio: string; fragmento: string } {
  const marca = link.indexOf('#')
  if (marca < 0) throw new RangeError('Link sem fragmento')
  return { inicio: link.slice(0, marca), fragmento: link.slice(marca + 1) }
}

export async function encurtarVolta(link: string, agora: number, opcoes: Opcoes): Promise<string> {
  const { inicio, fragmento } = partesDoLink(link)
  const codigo = novoCodigo()
  await guardar(codigo, fragmento, Math.floor(agora / 1000) + VIDA_DA_VOLTA_S, opcoes)
  return `${inicio}#${codigo}`
}
