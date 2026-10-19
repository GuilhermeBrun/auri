import { addDays, addMinutes, format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { FUNCIONAMENTO_PADRAO, horarioDoDia, minutesOf, type Funcionamento } from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment, Presenca } from '@shared/schemas'

export const PRESENCA_LABELS: Record<Presenca, string> = {
  presente: 'Presente',
  falta: 'Faltou',
  desmarcou: 'Desmarcou'
}

export const PRESENCA_OPTIONS = Object.entries(PRESENCA_LABELS) as [Presenca, string][]

export const DEFAULT_DURATION = 30

export function nextSlot(now: Date, funcionamento: Funcionamento = FUNCIONAMENTO_PADRAO): Date {
  const minutes = now.getHours() * 60 + (now.getMinutes() < 30 ? 30 : 60)
  for (let offset = 0; offset < 8; offset++) {
    const day = addDays(startOfDay(now), offset)
    const horario = horarioDoDia(funcionamento, day)
    if (!horario) continue
    const abre = minutesOf(horario.abre)
    const start = offset === 0 ? Math.max(minutes, abre) : abre
    if (start + DEFAULT_DURATION <= minutesOf(horario.fecha)) return addMinutes(day, start)
  }
  return addMinutes(startOfDay(now), minutes)
}

export const PATIENTS_CRUMB = { label: 'Pacientes', to: '/pacientes' }

export function timeRange(a: Pick<Appointment, 'inicio' | 'fim'>): string {
  return `${formatTime(parseIsoLocalDateTime(a.inicio))}–${formatTime(parseIsoLocalDateTime(a.fim))}`
}

export function spokenDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}
