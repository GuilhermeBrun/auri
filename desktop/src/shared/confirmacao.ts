import type { LinkCurto } from './link-curto'

export const PRAZO_DA_CONFIRMACAO_MS = 2 * 60 * 60 * 1000
export const ANTES_DA_SESSAO_MS = 15 * 60 * 1000
export const MENOR_PRAZO_MS = 15 * 60 * 1000
export const TOLERANCIA_DA_RESPOSTA_MS = 5 * 60 * 1000

export const prazoDaConfirmacao = (inicio: Date, agora: Date): Date =>
  new Date(
    Math.min(agora.getTime() + PRAZO_DA_CONFIRMACAO_MS, inicio.getTime() - ANTES_DA_SESSAO_MS)
  )

export const prazoCurtoDemais = (inicio: Date, agora: Date): boolean =>
  prazoDaConfirmacao(inicio, agora).getTime() - agora.getTime() < MENOR_PRAZO_MS

export const PERTO_DEMAIS =
  'A sessão começa em menos de 30 minutos. Confirme com a família por telefone.'

export type EstadoDoPedido = 'aguardando' | 'confirmado' | 'desmarcado' | 'sem_resposta'

export type PedidoNaSessao = { estado: EstadoDoPedido; prazo: string }

export const PEDIDO_LABELS: Record<EstadoDoPedido, string> = {
  aguardando: 'Aguardando resposta',
  confirmado: 'Confirmou pelo link',
  desmarcado: 'Desmarcou pelo link',
  sem_resposta: 'Sem resposta, horário liberado'
}

export type RegistroDoPedido = {
  estado: 'aguardando' | 'respondido' | 'vencido'
  resposta: 'confirmada' | 'desmarcada' | null
  prazo: string
}

export function pedidoNaSessao(
  registro: RegistroDoPedido | null,
  confirmadoEm: string | null
): PedidoNaSessao | null {
  if (!registro) return null
  const { prazo } = registro
  if (registro.estado === 'vencido') return { estado: 'sem_resposta', prazo }
  if (registro.estado === 'respondido') {
    return { estado: registro.resposta === 'desmarcada' ? 'desmarcado' : 'confirmado', prazo }
  }
  return { estado: confirmadoEm === null ? 'aguardando' : 'confirmado', prazo }
}

export type Contato = { nome: string; parentesco: string; celular: string }

export type ConfirmacaoLinha = {
  appointment_id: number
  inicio: string
  fim: string
  patient_id: number
  patient_nome: string
  tipo_nome: string
  contato: Contato | null
  confirmado: boolean
  pedido: PedidoNaSessao | null
}

export type JanelaDeEnvio = { aberta: true; ate: string } | { aberta: false; motivo: string }

export type ConfirmacaoLista = {
  dia: string | null
  janela: JanelaDeEnvio
  sessoes: ConfirmacaoLinha[]
}

export type ConfirmacaoEnvio = {
  appointment_id: number
  link: string
  numero: string
  mensagem: string
  prazo: string
  reenvio: boolean
  curto?: LinkCurto
}

export type Vaga = { inicio: string; fim: string }

export type ConfirmacaoRecebida =
  | {
      ok: true
      tipo: 'confirmada' | 'desmarcada' | 'repetida' | 'outra' | 'conferir'
      resposta: 'confirmada' | 'desmarcada'
      titulo: string
      detalhe: string
      request_id: number
      appointment_id: number
      vaga: Vaga | null
    }
  | { ok: false; erro: string }

type AvisoBase = {
  request_id: number
  appointment_id: number
  patient_nome: string
  inicio: string
  fim: string
}

export type HorarioLiberado = AvisoBase & {
  motivo: 'sem_resposta' | 'desmarcou'
  falta_cobrada: boolean
  cobranca_erro: string | null
}

export type OutraResposta = AvisoBase & {
  resposta: 'confirmada' | 'desmarcada'
  vencido: boolean
}

export type AvisosDaConfirmacao = { liberados: HorarioLiberado[]; outras: OutraResposta[] }
