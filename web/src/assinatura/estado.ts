import { sha256 } from '../../contrato/assinatura/cifra'
import {
  LinkInvalido,
  PAPEIS,
  VERSAO,
  idDaVolta,
  lerIda,
  venceu,
  type Termo
} from '../../contrato/assinatura/formato'
import { ehCodigo } from '../../contrato/link-curto'
import { expandir, type Rede } from './link'
import { codificar, type Ponto } from '../../contrato/assinatura/traco'
import { opcoesDePapel, type Preenchido } from './textos'

export type Aberto = { termo: Termo; chave: Uint8Array; h: string }

export type Estado =
  | { tela: 'abrindo' }
  | { tela: 'sem-suporte' }
  | { tela: 'incompleto' }
  | { tela: 'versao' }
  | { tela: 'sumiu' }
  | { tela: 'sem-conexao' }
  | { tela: 'vencido'; termo: Termo }
  | { tela: 'termo'; aberto: Aberto; rascunho: Preenchido | null }
  | { tela: 'enviado'; termo: Termo; mensagem: string }

export type Rascunho = { preenchido: Preenchido } | { enviado: string }

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>

type Ambiente = {
  crypto?: { subtle?: unknown }
  CompressionStream?: unknown
  DecompressionStream?: unknown
}

export const temSuporte = (ambiente: Ambiente = globalThis): boolean =>
  Boolean(ambiente.crypto?.subtle && ambiente.CompressionStream && ambiente.DecompressionStream)

const chaveDoRascunho = (id: string): string => `auri-termo-${id}`

function preenchidoValido(valor: unknown): valor is Preenchido {
  if (typeof valor !== 'object' || valor === null) return false
  const { nome, cpf, rel, aceite, tracos } = valor as Record<string, unknown>
  if (
    typeof nome !== 'string' ||
    typeof cpf !== 'string' ||
    !/^\d{0,11}$/.test(cpf) ||
    typeof aceite !== 'boolean' ||
    !PAPEIS.some((papel) => papel === rel) ||
    !Array.isArray(tracos) ||
    !tracos.every((traco) => Array.isArray(traco) && traco.every(Array.isArray))
  ) {
    return false
  }
  try {
    codificar(tracos as unknown as Ponto[][])
    return true
  } catch {
    return false
  }
}

export function lerRascunho(id: string, armazenamento?: Armazenamento): Rascunho | null {
  try {
    const bruto = (armazenamento ?? sessionStorage).getItem(chaveDoRascunho(id))
    const valor: unknown = bruto ? JSON.parse(bruto) : null
    if (typeof valor !== 'object' || valor === null) return null
    if ('enviado' in valor && typeof valor.enviado === 'string') return { enviado: valor.enviado }
    if ('preenchido' in valor && preenchidoValido(valor.preenchido)) {
      return { preenchido: valor.preenchido }
    }
  } catch {}
  return null
}

export function guardarRascunho(id: string, rascunho: Rascunho, armazenamento?: Armazenamento) {
  try {
    ;(armazenamento ?? sessionStorage).setItem(chaveDoRascunho(id), JSON.stringify(rascunho))
  } catch {}
}

export async function abrir(
  fragmento: string,
  armazenamento?: Armazenamento,
  agora: number = Date.now(),
  ambiente: Ambiente = globalThis,
  rede: Rede = {}
): Promise<Estado> {
  if (!temSuporte(ambiente)) return { tela: 'sem-suporte' }
  try {
    const expandido = await expandir(fragmento, VERSAO, rede)
    if ('falha' in expandido) return { tela: expandido.falha }
    const { termo, chave } = await lerIda(expandido.fragmento)
    const rascunho = lerRascunho(termo.id, armazenamento)
    if (rascunho && 'enviado' in rascunho) {
      return { tela: 'enviado', termo, mensagem: rascunho.enviado }
    }
    if (venceu(termo, agora)) return { tela: 'vencido', termo }
    const preenchido = rascunho?.preenchido ?? null
    const papelValido = opcoesDePapel(termo).some(({ papel }) => papel === preenchido?.rel)
    return {
      tela: 'termo',
      aberto: { termo, chave, h: await sha256(termo.txt) },
      rascunho: preenchido && !papelValido ? { ...preenchido, rel: termo.resp.papel } : preenchido
    }
  } catch (erro) {
    if (erro instanceof LinkInvalido && erro.motivo === 'versao') return { tela: 'versao' }
    return { tela: 'incompleto' }
  }
}

export function avaliarRecebido(fragmento: string): 'pronto' | 'incompleto' | 'versao' {
  if (ehCodigo(fragmento.replace(/^#/, ''))) return 'pronto'
  try {
    idDaVolta(fragmento)
    return 'pronto'
  } catch (erro) {
    return erro instanceof LinkInvalido && erro.motivo === 'versao' ? 'versao' : 'incompleto'
  }
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
