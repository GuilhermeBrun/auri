import { foraDoFuncionamento, type Funcionamento } from '@shared/agenda'
import type { AuriApi } from '@shared/api'
import { commitmentName, type Commitment } from '@shared/commitments'
import { parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import type { Appointment, AppointmentInput } from '@shared/schemas'
import { horarioTexto } from '@renderer/lib/waitlist'

export type Arrastavel =
  | { kind: 'appointment'; appointment: Appointment }
  | { kind: 'commitment'; commitment: Commitment }

export type Destino = { inicio: string; fim: string }

type Api = Pick<AuriApi, 'appointments' | 'commitments'>

export function horarioDe(item: Arrastavel): Destino {
  const { inicio, fim } = item.kind === 'appointment' ? item.appointment : item.commitment
  return { inicio, fim }
}

export function podeArrastar(item: Arrastavel, agora: Date): boolean {
  if (item.kind === 'commitment') return true
  const { assinatura, inicio } = item.appointment
  return assinatura === null && parseIsoLocalDateTime(inicio) > agora
}

export function destinoDe(start: Date | string, end: Date | string): Destino {
  return {
    inicio: toIsoLocalDateTime(new Date(start)),
    fim: toIsoLocalDateTime(new Date(end))
  }
}

export function mesmoLugar(item: Arrastavel, destino: Destino): boolean {
  const atual = horarioDe(item)
  return atual.inicio === destino.inicio && atual.fim === destino.fim
}

export const HORARIO_PASSADO = 'Esse horário já passou.'

export function problemaNoDestino(
  item: Arrastavel,
  destino: Destino,
  funcionamento: Funcionamento,
  agora: Date
): string | null {
  const inicio = parseIsoLocalDateTime(destino.inicio)
  if (item.kind === 'appointment' && inicio <= agora) return HORARIO_PASSADO
  return foraDoFuncionamento(funcionamento, inicio, parseIsoLocalDateTime(destino.fim))
}

function entrada(a: Appointment, destino: Destino): AppointmentInput {
  return {
    patient_id: a.patient_id,
    inicio: destino.inicio,
    fim: destino.fim,
    observacao: a.observacao,
    tipo_id: a.tipo_id,
    presenca: a.presenca,
    evolucao: a.evolucao
  }
}

async function gravarSessao(
  api: Api,
  a: Appointment,
  destino: Destino,
  computador: string
): Promise<Appointment> {
  if (destino.inicio !== a.inicio) {
    return api.appointments.move(a.id, destino, a.updated_at, computador)
  }
  return api.appointments.update(a.id, entrada(a, destino), a.updated_at, computador)
}

export async function gravar(
  api: Api,
  item: Arrastavel,
  destino: Destino,
  computador: string
): Promise<Arrastavel> {
  if (item.kind === 'appointment') {
    const appointment = await gravarSessao(api, item.appointment, destino, computador)
    return { kind: 'appointment', appointment }
  }
  const { etiqueta_id, titulo, observacao, id, updated_at } = item.commitment
  const commitment = await api.commitments.update(
    id,
    { etiqueta_id, titulo, observacao, ...destino },
    updated_at
  )
  return { kind: 'commitment', commitment }
}

export async function desfazer(
  api: Api,
  original: Arrastavel,
  gravado: Arrastavel,
  computador: string
): Promise<Arrastavel> {
  const volta = await gravar(api, gravado, horarioDe(original), computador)
  if (
    original.kind !== 'appointment' ||
    volta.kind !== 'appointment' ||
    !original.appointment.confirmado_em ||
    volta.appointment.confirmado_em
  ) {
    return volta
  }
  const a = volta.appointment
  const appointment = await api.appointments.update(
    a.id,
    { ...entrada(a, horarioDe(volta)), confirmado: true },
    a.updated_at,
    computador
  )
  return { kind: 'appointment', appointment }
}

export function tituloDoAviso(original: Arrastavel, destino: Destino): string {
  if (original.kind === 'commitment') return 'Compromisso movido'
  return destino.inicio === original.appointment.inicio ? 'Duração alterada' : 'Sessão remarcada'
}

export function descricaoDoAviso(item: Arrastavel): string {
  return item.kind === 'appointment'
    ? `${shortName(item.appointment.patient_nome)} · ${horarioTexto(item.appointment)}`
    : `${commitmentName(item.commitment)} · ${horarioTexto(item.commitment)}`
}

export function avisoDeErro(mensagem: string): { title: string; description: string } {
  const [titulo, ...resto] = mensagem.split(': ')
  const detalhe = resto.join(': ')
  if (!detalhe) return { title: 'Não foi possível mover', description: mensagem }
  return { title: titulo, description: detalhe.charAt(0).toUpperCase() + detalhe.slice(1) }
}
