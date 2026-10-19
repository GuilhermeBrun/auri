import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { parseIsoLocalDateTime } from '@shared/dates'
import type { Intervalo, Periodo } from '@shared/encaixe'

export const DIAS_ESPERA: [number, string][] = [
  [1, 'Seg'],
  [2, 'Ter'],
  [3, 'Qua'],
  [4, 'Qui'],
  [5, 'Sex'],
  [6, 'Sáb']
]

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export const PERIODO_LABELS: Record<Periodo, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite'
}

export const PERIODO_OPTIONS = Object.entries(PERIODO_LABELS) as [Periodo, string][]

export const DURACOES_ESPERA = [30, 45, 60, 90]

export function preferenciasTexto(dias: readonly number[], periodos: readonly Periodo[]): string {
  if (dias.length === 0 && periodos.length === 0) return 'Qualquer dia e horário'
  const quando = dias.length === 0 ? 'qualquer dia' : dias.map((d) => DIA_CURTO[d]).join(', ')
  const turno =
    periodos.length === 0
      ? 'qualquer horário'
      : periodos.map((p) => PERIODO_LABELS[p].toLowerCase()).join(', ')
  return `${quando} · ${turno}`
}

const DIA_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const PERIODO_FRASE: Record<Periodo, string> = {
  manha: 'de manhã',
  tarde: 'à tarde',
  noite: 'à noite'
}

function ou(itens: string[]): string {
  return itens.length <= 1
    ? (itens[0] ?? '')
    : `${itens.slice(0, -1).join(', ')} ou ${itens.at(-1)}`
}

export function resumoEspera(
  tipo: string,
  duracao: number,
  dias: readonly number[],
  periodos: readonly Periodo[]
): string {
  const inicio = `${tipo} de ${duracao} min`
  if (dias.length === 0 && periodos.length === 0) return `${inicio}, em qualquer dia e horário.`
  const quando = dias.length === 0 ? 'qualquer dia' : ou(dias.map((d) => DIA_NOME[d]))
  const turno =
    periodos.length === 0 ? 'qualquer horário' : ou(periodos.map((p) => PERIODO_FRASE[p]))
  return `${inicio}, ${quando}, ${turno}.`
}

export function esperaTexto(createdAt: string, now: Date): string {
  const dias = differenceInCalendarDays(now, new Date(createdAt))
  if (dias <= 0) return 'Entrou hoje'
  return dias === 1 ? 'Esperando há 1 dia' : `Esperando há ${dias} dias`
}

export function horarioTexto({ inicio, fim }: Intervalo): string {
  const de = parseIsoLocalDateTime(inicio)
  const dia = `${DIA_CURTO[de.getDay()]}, ${format(de, "d 'de' MMM", { locale: ptBR })}`
  return `${dia} · ${format(de, 'HH:mm')}–${format(parseIsoLocalDateTime(fim), 'HH:mm')}`
}
