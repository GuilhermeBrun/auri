import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { toIsoDate } from '@shared/dates'

export type Range = { de: string; ate: string }

export function monthRange(date: Date): Range {
  return { de: toIsoDate(startOfMonth(date)), ate: toIsoDate(endOfMonth(date)) }
}

export function monthLabel(date: Date): string {
  const text = format(date, "MMMM 'de' yyyy", { locale: ptBR })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
