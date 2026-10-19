import { LinkInvalido } from '../../contrato/assinatura/formato'
import {
  RESPOSTAS,
  idDaVolta,
  lerIda,
  passou,
  venceu,
  type Confirmacao,
  type Decisao,
  type Resposta
} from '../../contrato/confirmacao/formato'
import type { Situacao } from '../assinatura/Devolucao'
import { temSuporte } from '../assinatura/estado'

export type Aberta = { confirmacao: Confirmacao; chave: Uint8Array }

export type Estado =
  | { tela: 'abrindo' }
  | { tela: 'sem-suporte' }
  | { tela: 'incompleto' }
  | { tela: 'versao' }
  | { tela: 'passou'; confirmacao: Confirmacao }
  | { tela: 'vencido'; confirmacao: Confirmacao }
  | { tela: 'pergunta'; aberta: Aberta }
  | { tela: 'enviado'; confirmacao: Confirmacao; res: Decisao; mensagem: string }

export type Enviado = { res: Decisao; mensagem: string }

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>

type Ambiente = Parameters<typeof temSuporte>[0]

const chaveDoEnvio = (id: string): string => `auri-confirmacao-${id}`

export function lerEnviado(id: string, armazenamento?: Armazenamento): Enviado | null {
  try {
    const bruto = (armazenamento ?? sessionStorage).getItem(chaveDoEnvio(id))
    const valor: unknown = bruto ? JSON.parse(bruto) : null
    if (typeof valor !== 'object' || valor === null) return null
    const { res, mensagem } = valor as Record<string, unknown>
    const decisao = RESPOSTAS.find((item) => item === res)
    if (decisao && typeof mensagem === 'string') return { res: decisao, mensagem }
  } catch {}
  return null
}

export function guardarEnviado(id: string, enviado: Enviado, armazenamento?: Armazenamento) {
  try {
    ;(armazenamento ?? sessionStorage).setItem(chaveDoEnvio(id), JSON.stringify(enviado))
  } catch {}
}

export function situacao(confirmacao: Confirmacao, agora: number): 'passou' | 'vencido' | null {
  if (passou(confirmacao, agora)) return 'passou'
  if (venceu(confirmacao, agora)) return 'vencido'
  return null
}

export async function abrir(
  fragmento: string,
  armazenamento?: Armazenamento,
  agora: number = Date.now(),
  ambiente: Ambiente = globalThis
): Promise<Estado> {
  if (!temSuporte(ambiente)) return { tela: 'sem-suporte' }
  try {
    const { confirmacao, chave } = await lerIda(fragmento)
    const enviado = lerEnviado(confirmacao.id, armazenamento)
    if (enviado) return { tela: 'enviado', confirmacao, ...enviado }
    const fim = situacao(confirmacao, agora)
    if (fim) return { tela: fim, confirmacao }
    return { tela: 'pergunta', aberta: { confirmacao, chave } }
  } catch (erro) {
    if (erro instanceof LinkInvalido && erro.motivo === 'versao') return { tela: 'versao' }
    return { tela: 'incompleto' }
  }
}

export function avaliarResposta(fragmento: string): Situacao {
  try {
    idDaVolta(fragmento)
    return 'pronto'
  } catch (erro) {
    return erro instanceof LinkInvalido && erro.motivo === 'versao' ? 'versao' : 'incompleto'
  }
}

export const mesmoFuso = (tz: number, agora: Date = new Date()): boolean =>
  -agora.getTimezoneOffset() === tz

export const respostaDe = (confirmacao: Confirmacao, res: Decisao, agora: Date): Resposta => ({
  id: confirmacao.id,
  res,
  em: Math.floor(agora.getTime() / 1000),
  tz: 0 - agora.getTimezoneOffset()
})
