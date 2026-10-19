import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { parseIsoLocalDateTime } from '@shared/dates'

export function duracaoTexto(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function quando(inicio: string): string {
  const date = parseIsoLocalDateTime(inicio)
  const weekday = format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
  return `${weekday}, ${format(date, "d 'de' MMM", { locale: ptBR })} às ${format(date, 'HH:mm')}`
}
