import { addDays, differenceInMinutes, format, setHours, setMinutes, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { DAY_END_HOUR, DAY_START_HOUR } from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment, AppointmentTipo, Presenca } from '@shared/schemas'

export const TIPO_LABELS: Record<AppointmentTipo, string> = {
  sessao: 'Sessão',
  avaliacao: 'Avaliação'
}

export const PRESENCA_LABELS: Record<Presenca, string> = {
  presente: 'Presente',
  falta: 'Faltou',
  desmarcou: 'Desmarcou'
}

export const TIPO_OPTIONS = Object.entries(TIPO_LABELS) as [AppointmentTipo, string][]
export const PRESENCA_OPTIONS = Object.entries(PRESENCA_LABELS) as [Presenca, string][]

export const DEFAULT_DURATION = 30

export function nextSlot(now: Date): Date {
  const minutes = now.getMinutes() < 30 ? 30 : 60
  const slot = setMinutes(setHours(startOfDay(now), now.getHours()), minutes)
  if (slot.getHours() < DAY_START_HOUR) return setHours(startOfDay(now), DAY_START_HOUR)
  if (differenceInMinutes(setHours(startOfDay(now), DAY_END_HOUR), slot) < DEFAULT_DURATION) {
    return setHours(startOfDay(addDays(now, 1)), DAY_START_HOUR)
  }
  return slot
}

export const PATIENTS_CRUMB = { label: 'Pacientes', to: '/pacientes' }

export function timeRange(a: Pick<Appointment, 'inicio' | 'fim'>): string {
  return `${formatTime(parseIsoLocalDateTime(a.inicio))}–${formatTime(parseIsoLocalDateTime(a.fim))}`
}

export function spokenDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}
