import { deBase64url, paraBase64url } from '../assinatura/base64url'
import { cifrar, decifrar } from '../assinatura/cifra'
import { comprimir, descomprimir } from '../assinatura/compressao'
import {
  LinkInvalido,
  LinkLongo,
  ORIGEM,
  campos,
  idValido,
  inteiro,
  partes as partesDoLink,
  texto
} from '../assinatura/formato'

export const VERSAO = 1
export const LIMITE_IDA = 1000
export const LIMITE_VOLTA = 400
export const CAMINHO_DA_IDA = 'confirmar'
export const CAMINHO_DA_VOLTA = 'resposta'

const MENOR_PACOTE = 28
const MAXIMO_DO_TEXTO = 2048

export const RESPOSTAS = ['confirmada', 'desmarcada'] as const
export type Decisao = (typeof RESPOSTAS)[number]

export type Confirmacao = {
  id: string
  ate: number
  tz: number
  cli: { nome: string; whats: string }
  pac: { nome: string }
  ses: { ini: number; dur: number; prof: string }
  cob: boolean
}

export type Resposta = {
  id: string
  res: Decisao
  em: number
  tz: number
}

export const DADO_DA_IDA = `auri/confirmacao/${VERSAO}/ida`
export const dadoDaVolta = (id: string): string => `auri/confirmacao/${VERSAO}/volta/${id}`
const leitor = new TextDecoder('utf-8', { fatal: true })

const fuso = (valor: unknown, nome: string): number => inteiro(valor, nome, -840, 840)
const instante = (valor: unknown, nome: string): number => inteiro(valor, nome, 0, 2 ** 32)

export function confirmacaoValida(valor: unknown): Confirmacao {
  const confirmacao = campos(valor, 'confirmação')
  const cli = campos(confirmacao.cli, 'cli')
  const pac = campos(confirmacao.pac, 'pac')
  const ses = campos(confirmacao.ses, 'ses')
  if (typeof confirmacao.cob !== 'boolean') throw new TypeError('cob inválido')
  const ate = instante(confirmacao.ate, 'ate')
  const ini = instante(ses.ini, 'ses.ini')
  if (ate > ini) throw new TypeError('ate depois do início da sessão')
  return {
    id: idValido(confirmacao.id),
    ate,
    tz: fuso(confirmacao.tz, 'tz'),
    cli: {
      nome: texto(cli.nome, 'cli.nome', 80),
      whats: texto(cli.whats, 'cli.whats', 15, { padrao: /^\d{10,15}$/ })
    },
    pac: { nome: texto(pac.nome, 'pac.nome', 120) },
    ses: {
      ini,
      dur: inteiro(ses.dur, 'ses.dur', 5, 600),
      prof: texto(ses.prof, 'ses.prof', 120)
    },
    cob: confirmacao.cob
  }
}

export function respostaValida(valor: unknown): Resposta {
  const resposta = campos(valor, 'resposta')
  const res = RESPOSTAS.find((item) => item === resposta.res)
  if (!res) throw new TypeError('res inválido')
  return {
    id: idValido(resposta.id),
    res,
    em: instante(resposta.em, 'em'),
    tz: fuso(resposta.tz, 'tz')
  }
}

export const partes = (fragmento: string): [string, string] => partesDoLink(fragmento, VERSAO)

export const tamanhoNoSite = (caminho: string, fragmento: string): number =>
  `${ORIGEM}/${caminho}#${fragmento}`.length

const json = (valor: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(valor))

async function abrir(chave: Uint8Array, dadoAdicional: string, dados: string): Promise<unknown> {
  const bytes = await descomprimir(await decifrar(chave, dadoAdicional, deBase64url(dados)))
  return lerJson(bytes)
}

export function lerJson(bytes: Uint8Array): unknown {
  if (bytes.length > MAXIMO_DO_TEXTO) throw new RangeError('Conteúdo grande demais')
  return JSON.parse(leitor.decode(bytes))
}

type Opcoes = { origem?: string; limite?: number }

export function linkDaIda(fragmento: string, origem: string, limite: number): string {
  const tamanho = tamanhoNoSite(CAMINHO_DA_IDA, fragmento)
  if (tamanho > limite) throw new LinkLongo(tamanho, limite)
  return `${origem}/${CAMINHO_DA_IDA}#${fragmento}`
}

export function linkDaVolta(fragmento: string, origem: string, limite: number): string {
  const tamanho = tamanhoNoSite(CAMINHO_DA_VOLTA, fragmento)
  if (tamanho > limite) throw new LinkLongo(tamanho, limite)
  return `${origem}/${CAMINHO_DA_VOLTA}#${fragmento}`
}

export async function montarIda(
  confirmacao: Confirmacao,
  chave: Uint8Array,
  { origem = ORIGEM, limite = LIMITE_IDA }: Opcoes = {}
): Promise<string> {
  const corpo = await comprimir(json(confirmacaoValida(confirmacao)))
  const dados = await cifrar(chave, DADO_DA_IDA, corpo)
  return linkDaIda(`${VERSAO}.${paraBase64url(chave)}.${paraBase64url(dados)}`, origem, limite)
}

export async function lerIda(
  fragmento: string
): Promise<{ chave: Uint8Array; confirmacao: Confirmacao }> {
  const [chaveTexto, dados] = partes(fragmento)
  try {
    const chave = deBase64url(chaveTexto)
    return { chave, confirmacao: confirmacaoValida(await abrir(chave, DADO_DA_IDA, dados)) }
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}

export async function montarVolta(
  chave: Uint8Array,
  resposta: Resposta,
  { origem = ORIGEM, limite = LIMITE_VOLTA }: Opcoes = {}
): Promise<string> {
  const valida = respostaValida(resposta)
  const dados = await cifrar(chave, dadoDaVolta(valida.id), await comprimir(json(valida)))
  return linkDaVolta(`${VERSAO}.${valida.id}.${paraBase64url(dados)}`, origem, limite)
}

export function respostaDoEnvio(valor: unknown, id: string): Resposta {
  const resposta = respostaValida(valor)
  if (resposta.id !== id) throw new TypeError('id diferente do de fora')
  return resposta
}

export function idDaVolta(fragmento: string): string {
  const [id, dados] = partes(fragmento)
  try {
    if (deBase64url(dados).length < MENOR_PACOTE) throw new RangeError('Pacote curto')
    return idValido(id)
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}

export async function lerVolta(fragmento: string, chave: Uint8Array): Promise<Resposta> {
  const id = idDaVolta(fragmento)
  const [, dados] = partes(fragmento)
  try {
    return respostaDoEnvio(await abrir(chave, dadoDaVolta(id), dados), id)
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}

export function fragmentoDaVolta(mensagem: string): string | null {
  const link = new RegExp(`/${CAMINHO_DA_VOLTA}/?#(\\d+\\.[\\w-]+\\.[\\w-]+)`).exec(mensagem)
  if (link) return link[1]
  const limpo = mensagem.trim()
  return /^\d+\.[\w-]+\.[\w-]+$/.test(limpo) ? limpo : null
}

export const venceu = (confirmacao: Confirmacao, agora: number = Date.now()): boolean =>
  agora / 1000 > confirmacao.ate

export const passou = (confirmacao: Confirmacao, agora: number = Date.now()): boolean =>
  agora / 1000 >= confirmacao.ses.ini
