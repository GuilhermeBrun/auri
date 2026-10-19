export const PRAZO_DA_CONFIRMACAO_MS = 2 * 60 * 60 * 1000
export const TOLERANCIA_DA_RESPOSTA_MS = 5 * 60 * 1000

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
}

export type Vaga = { inicio: string; fim: string }

export type ConfirmacaoRecebida =
  | {
      ok: true
      tipo: 'confirmada' | 'desmarcada' | 'repetida' | 'outra' | 'no_prazo'
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
  cobranca_erro: string | null
}

export type OutraResposta = AvisoBase & { resposta: 'confirmada' | 'desmarcada' }

export type AvisosDaConfirmacao = { liberados: HorarioLiberado[]; outras: OutraResposta[] }
