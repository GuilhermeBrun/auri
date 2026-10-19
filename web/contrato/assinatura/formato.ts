import { deBase64url, paraBase64url } from './base64url'
import { cifrar, decifrar } from './cifra'
import { comprimir, descomprimir } from './compressao'
import { lerConteudo } from './conteudo'
import {
  TOLERANCIAS,
  codificar,
  decodificar,
  simplificar,
  type Assinatura,
  type Ponto
} from './traco'

export const VERSAO = 1
export const ORIGEM = 'https://auri.dev.br'
export const LIMITE_IDA = 4000
export const LIMITE_VOLTA = 2000

export const MAXIMO_LIDO = 8192
const MAXIMO_DO_TEXTO = 16_000
const TAMANHO_DO_ID = 16
const MENOR_PACOTE = 28

export const PAPEIS = ['paciente', 'mae', 'pai', 'outro'] as const
export type Papel = (typeof PAPEIS)[number]

export type Termo = {
  id: string
  ate: number
  cli: { nome: string; whats: string }
  pac: { nome: string; nasc: string }
  resp: { papel: Papel; par?: string }
  mod: { titulo: string; versao: number }
  prof: { nome: string; reg: string }
  txt: string
}

export type Resposta = {
  id: string
  h: string
  nome: string
  cpf: string
  rel: Papel
  par?: string
  ok: true
  em: number
  tz: number
}

export type Volta = { resposta: Resposta; assinatura: Ponto[][] }

export class LinkInvalido extends Error {
  readonly motivo: 'incompleto' | 'versao'

  constructor(motivo: 'incompleto' | 'versao', opcoes?: ErrorOptions) {
    super(motivo === 'versao' ? 'Versão desconhecida' : 'Link incompleto ou adulterado', opcoes)
    this.name = 'LinkInvalido'
    this.motivo = motivo
  }
}

export class LinkLongo extends RangeError {
  readonly tamanho: number
  readonly limite: number

  constructor(tamanho: number, limite: number) {
    super(`Link com ${tamanho} caracteres, acima do limite de ${limite}`)
    this.name = 'LinkLongo'
    this.tamanho = tamanho
    this.limite = limite
  }
}

export const DADO_DA_IDA = `auri/termo/${VERSAO}/ida`
export const dadoDaVolta = (id: string): string => `auri/termo/${VERSAO}/volta/${id}`
const leitor = new TextDecoder('utf-8', { fatal: true })

export type Campos = Record<string, unknown>

export function campos(valor: unknown, nome: string): Campos {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new TypeError(`${nome}: esperado um objeto`)
  }
  return valor as Campos
}

export function texto(
  valor: unknown,
  nome: string,
  maximo: number,
  { padrao, vazio = false }: { padrao?: RegExp; vazio?: boolean } = {}
): string {
  if (
    typeof valor !== 'string' ||
    valor.length > maximo ||
    (!vazio && valor.trim() === '') ||
    (padrao && !padrao.test(valor))
  ) {
    throw new TypeError(`${nome} inválido`)
  }
  return valor
}

export function inteiro(valor: unknown, nome: string, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new TypeError(`${nome} inválido`)
  }
  return valor
}

export function idValido(valor: unknown): string {
  const id = texto(valor, 'id', 22, { padrao: /^[\w-]{22}$/ })
  try {
    if (deBase64url(id).length === TAMANHO_DO_ID) return id
  } catch {}
  throw new TypeError('id inválido')
}

function papelValido(valor: unknown, nome: string): Papel {
  const papel = PAPEIS.find((item) => item === valor)
  if (!papel) throw new TypeError(`${nome} inválido`)
  return papel
}

export function termoValido(valor: unknown): Termo {
  const termo = campos(valor, 'termo')
  const cli = campos(termo.cli, 'cli')
  const pac = campos(termo.pac, 'pac')
  const resp = campos(termo.resp, 'resp')
  const mod = campos(termo.mod, 'mod')
  const prof = campos(termo.prof, 'prof')
  const papel = papelValido(resp.papel, 'resp.papel')
  const txt = texto(termo.txt, 'txt', MAXIMO_DO_TEXTO)
  if (lerConteudo(txt).length === 0) throw new TypeError('txt sem conteúdo')
  return {
    id: idValido(termo.id),
    ate: inteiro(termo.ate, 'ate', 0, 2 ** 32),
    cli: {
      nome: texto(cli.nome, 'cli.nome', 80),
      whats: texto(cli.whats, 'cli.whats', 15, { padrao: /^\d{10,15}$/ })
    },
    pac: {
      nome: texto(pac.nome, 'pac.nome', 120),
      nasc: texto(pac.nasc, 'pac.nasc', 10, { padrao: /^\d{4}-\d{2}-\d{2}$/ })
    },
    resp: papel === 'outro' ? { papel, par: texto(resp.par, 'resp.par', 60) } : { papel },
    mod: {
      titulo: texto(mod.titulo, 'mod.titulo', 120),
      versao: inteiro(mod.versao, 'mod.versao', 1, 999_999)
    },
    prof: {
      nome: texto(prof.nome, 'prof.nome', 120),
      reg: texto(prof.reg, 'prof.reg', 40, { vazio: true })
    },
    txt
  }
}

export function respostaValida(valor: unknown): Resposta {
  const resposta = campos(valor, 'resposta')
  const rel = papelValido(resposta.rel, 'rel')
  if (resposta.ok !== true) throw new TypeError('ok inválido')
  return {
    id: idValido(resposta.id),
    h: texto(resposta.h, 'h', 64, { padrao: /^[\da-f]{64}$/ }),
    nome: texto(resposta.nome, 'nome', 120),
    cpf: texto(resposta.cpf, 'cpf', 11, { padrao: /^\d{11}$/ }),
    rel,
    ...(rel === 'outro' ? { par: texto(resposta.par, 'par', 60) } : {}),
    ok: true,
    em: inteiro(resposta.em, 'em', 0, 2 ** 32),
    tz: inteiro(resposta.tz, 'tz', -840, 840)
  }
}

export function partes(fragmento: string, esperada: number = VERSAO): [string, string] {
  const conteudo = fragmento.startsWith('#') ? fragmento.slice(1) : fragmento
  const [versao, ...resto] = conteudo.split('.')
  const atual = String(esperada)
  if (/^\d+$/.test(versao) && versao !== atual) throw new LinkInvalido('versao')
  if (conteudo.length > MAXIMO_LIDO || versao !== atual || resto.length !== 2) {
    throw new LinkInvalido('incompleto')
  }
  return [resto[0], resto[1]]
}

async function abrir(chave: Uint8Array, dadoAdicional: string, dados: string) {
  return descomprimir(await decifrar(chave, dadoAdicional, deBase64url(dados)))
}

export const tamanhoNoSite = (caminho: string, fragmento: string): number =>
  `${ORIGEM}/${caminho}#${fragmento}`.length

export const novoId = (): string =>
  paraBase64url(crypto.getRandomValues(new Uint8Array(TAMANHO_DO_ID)))

export const venceu = (termo: Termo, agora: number = Date.now()): boolean =>
  agora / 1000 > termo.ate

type Opcoes = { origem?: string; limite?: number }

export async function montarIda(
  termo: Termo,
  chave: Uint8Array,
  { origem = ORIGEM, limite = LIMITE_IDA }: Opcoes = {}
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(termoValido(termo)))
  const dados = await cifrar(chave, DADO_DA_IDA, await comprimir(json))
  const fragmento = `${VERSAO}.${paraBase64url(chave)}.${paraBase64url(dados)}`
  const tamanho = tamanhoNoSite('assinar', fragmento)
  if (tamanho > limite) throw new LinkLongo(tamanho, limite)
  return `${origem}/assinar#${fragmento}`
}

export async function lerIda(fragmento: string): Promise<{ chave: Uint8Array; termo: Termo }> {
  const [chaveTexto, dados] = partes(fragmento)
  try {
    const chave = deBase64url(chaveTexto)
    const json = leitor.decode(await abrir(chave, DADO_DA_IDA, dados))
    return { chave, termo: termoValido(JSON.parse(json)) }
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}

export async function montarVolta(
  chave: Uint8Array,
  resposta: Resposta,
  assinatura: Assinatura,
  { origem = ORIGEM, limite = LIMITE_VOLTA }: Opcoes = {}
): Promise<string> {
  const valida = respostaValida(resposta)
  const cabecalho = new TextEncoder().encode(JSON.stringify(valida))
  let tamanho = 0
  for (const tolerancia of TOLERANCIAS) {
    const traco = codificar(assinatura.map((linha) => simplificar(linha, tolerancia)))
    const corpo = new Uint8Array(2 + cabecalho.length + traco.length)
    new DataView(corpo.buffer).setUint16(0, cabecalho.length)
    corpo.set(cabecalho, 2)
    corpo.set(traco, 2 + cabecalho.length)
    const dados = await cifrar(chave, dadoDaVolta(valida.id), await comprimir(corpo))
    const fragmento = `${VERSAO}.${valida.id}.${paraBase64url(dados)}`
    tamanho = tamanhoNoSite('recebido', fragmento)
    if (tamanho <= limite) return `${origem}/recebido#${fragmento}`
  }
  throw new LinkLongo(tamanho, limite)
}

export function lerCorpoDaVolta(corpo: Uint8Array, id: string): Volta {
  const tamanho = new DataView(corpo.buffer, corpo.byteOffset, corpo.byteLength).getUint16(0)
  if (corpo.length < 2 + tamanho) throw new RangeError('Cabeçalho incompleto')
  const resposta = respostaValida(JSON.parse(leitor.decode(corpo.subarray(2, 2 + tamanho))))
  if (resposta.id !== id) throw new TypeError('id diferente do de fora')
  return { resposta, assinatura: decodificar(corpo.subarray(2 + tamanho)) }
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

export async function lerVolta(fragmento: string, chave: Uint8Array): Promise<Volta> {
  const id = idDaVolta(fragmento)
  const [, dados] = partes(fragmento)
  try {
    return lerCorpoDaVolta(await abrir(chave, dadoDaVolta(id), dados), id)
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}

export function fragmentoDaVolta(mensagem: string): string | null {
  const link = /\/recebido\/?#(\d+\.[\w-]+\.[\w-]+)/.exec(mensagem)
  if (link) return link[1]
  const limpo = mensagem.trim()
  return /^\d+\.[\w-]+\.[\w-]+$/.test(limpo) ? limpo : null
}

function digitoDoCpf(cpf: string, tamanho: number): number {
  let soma = 0
  for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i)
  return ((soma * 10) % 11) % 10
}

export function cpfValido(cpf: string): boolean {
  return (
    /^\d{11}$/.test(cpf) &&
    !/^(\d)\1{10}$/.test(cpf) &&
    digitoDoCpf(cpf, 9) === Number(cpf[9]) &&
    digitoDoCpf(cpf, 10) === Number(cpf[10])
  )
}

export const nomeCompleto = (nome: string): boolean =>
  nome
    .trim()
    .split(/\s+/)
    .filter((parte) => /\p{L}/u.test(parte)).length >= 2
