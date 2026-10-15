import { addDays, differenceInMinutes, setHours, setMinutes, startOfDay } from 'date-fns'
import { DAY_END_HOUR, DAY_START_HOUR } from '@shared/agenda'
import type { AppointmentTipo, Presenca } from '@shared/schemas'

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

/** Próximo horário cheio ou meia hora a partir de agora, dentro do expediente (à noite, o início de amanhã). */
export function nextSlot(now: Date): Date {
  const minutes = now.getMinutes() < 30 ? 30 : 60
  const slot = setMinutes(setHours(startOfDay(now), now.getHours()), minutes)
  if (slot.getHours() < DAY_START_HOUR) return setHours(startOfDay(now), DAY_START_HOUR)
  // sem lugar para uma sessão padrão antes das 20:00: a grade não tem esse horário
  if (differenceInMinutes(setHours(startOfDay(now), DAY_END_HOUR), slot) < DEFAULT_DURATION) {
    return setHours(startOfDay(addDays(now, 1)), DAY_START_HOUR)
  }
  return slot
}

/** Volta à lista de pacientes; o resto da trilha é o paciente aberto. */
export const PATIENTS_CRUMB = { label: 'Pacientes', to: '/pacientes' }
