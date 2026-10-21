import { addMinutes, differenceInMinutes, startOfDay } from 'date-fns'
import { foraDoFuncionamento, SLOT_MINUTES, type Funcionamento } from '@shared/agenda'
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

export type Soltura =
  | { tipo: 'volta' }
  | { tipo: 'recusa'; problema: string }
  | { tipo: 'move'; destino: Destino }

export function aoSoltar(
  item: Arrastavel,
  destino: Destino | null,
  funcionamento: Funcionamento,
  agora: Date
): Soltura {
  if (!destino || mesmoLugar(item, destino)) return { tipo: 'volta' }
  const problema = problemaNoDestino(item, destino, funcionamento, agora)
  return problema ? { tipo: 'recusa', problema } : { tipo: 'move', destino }
}

export const LIMIAR = 5

export type Ponto = { x: number; y: number }

export function passouDoLimiar(inicio: Ponto, agora: Ponto): boolean {
  return Math.abs(agora.x - inicio.x) > LIMIAR || Math.abs(agora.y - inicio.y) > LIMIAR
}

export function posicaoLivre(ponteiro: Ponto, pega: Ponto): Ponto {
  return { x: ponteiro.x - pega.x, y: ponteiro.y - pega.y }
}

export function duracaoDe(item: Arrastavel): number {
  const { inicio, fim } = horarioDe(item)
  return differenceInMinutes(parseIsoLocalDateTime(fim), parseIsoLocalDateTime(inicio))
}

export function minutosDaGrade(
  min: Date,
  max: Date,
  faixa: number
): { abre: number; minutos: number } {
  return {
    abre: min.getHours() * 60 + min.getMinutes(),
    minutos: Math.ceil(differenceInMinutes(max, min) / faixa) * faixa
  }
}

export type Coluna = { dia: Date; esquerda: number; direita: number }

export type Grade = {
  colunas: readonly Coluna[]
  topo: number
  altura: number
  abre: number
  minutos: number
}

export type Alvo = { coluna: number; minuto: number; destino: Destino }

export function alvoNoPonto(
  grade: Grade,
  x: number,
  topoDoCartao: number,
  duracao: number
): Alvo | null {
  const coluna = grade.colunas.findIndex((c) => x >= c.esquerda && x < c.direita)
  if (coluna < 0 || grade.altura <= 0) return null
  const livre = grade.abre + ((topoDoCartao - grade.topo) / grade.altura) * grade.minutos
  const ultimo = Math.max(
    grade.abre,
    Math.floor((grade.abre + grade.minutos - duracao) / SLOT_MINUTES) * SLOT_MINUTES
  )
  const preso = Math.round(livre / SLOT_MINUTES) * SLOT_MINUTES
  const minuto = Math.min(Math.max(preso, grade.abre), ultimo)
  const inicio = addMinutes(startOfDay(grade.colunas[coluna].dia), minuto)
  return { coluna, minuto, destino: destinoDe(inicio, addMinutes(inicio, duracao)) }
}

export type Area = { topo: number; baixo: number; esquerda: number; direita: number }

export const BORDA_DE_ROLAGEM = 40
const ROLAGEM_MAXIMA = 14

export function rolagemNaBorda(ponteiro: Ponto, area: Area): number {
  if (ponteiro.x < area.esquerda || ponteiro.x > area.direita) return 0
  const acima = area.topo + BORDA_DE_ROLAGEM - ponteiro.y
  const abaixo = ponteiro.y - (area.baixo - BORDA_DE_ROLAGEM)
  const perto = Math.max(acima, abaixo)
  if (perto <= 0) return 0
  const passo = Math.ceil(Math.min(1, perto / BORDA_DE_ROLAGEM) * ROLAGEM_MAXIMA)
  return acima > 0 ? -passo : passo
}

export function topoDoMinuto(grade: Grade, minuto: number): number {
  return grade.topo + ((minuto - grade.abre) / grade.minutos) * grade.altura
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
