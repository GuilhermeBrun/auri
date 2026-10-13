import type { BackupFrequency } from '../../shared/api'

/** "A cada alteração": espera este tempo sem mudanças, para juntar várias numa cópia só. */
export const CHANGE_DELAY_MS = 5 * 60_000
/** Depois de uma falha (pasta fora do ar, pendrive desconectado), tenta de novo após este tempo. */
export const RETRY_MS = 5 * 60_000
/** Sem cópia há mais que isso, a aba avisa. */
export const STALE_MS = 3 * 24 * 60 * 60_000

export type ScheduleState = {
  frequency: BackupFrequency
  /** "HH:mm" da cópia diária. */
  dailyTime: string
  /** ISO de quando começou a última cópia que deu certo. */
  lastSuccessAt: string | null
  /** ISO da última gravação nos dados. */
  lastChangeAt: string | null
  /** ISO da última falha. */
  lastErrorAt: string | null
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) : -Infinity)

/** Último horário diário que já chegou: hoje às HH:mm, ou ontem se hoje ainda não deu a hora. */
export function lastDailySlot(now: Date, dailyTime: string): Date {
  const [hours, minutes] = dailyTime.split(':').map(Number)
  const slot = new Date(now)
  slot.setHours(hours, minutes, 0, 0)
  if (slot.getTime() > now.getTime()) slot.setDate(slot.getDate() - 1)
  return slot
}

/**
 * Se está na hora de uma cópia automática. Diária: a última cópia é de antes do último horário,
 * o que também cobre o computador desligado na hora (copia assim que o Auri abrir). A cada
 * alteração: houve mudança depois da última cópia e já faz `CHANGE_DELAY_MS` desde a última.
 */
export function isBackupDue(state: ScheduleState, now: Date): boolean {
  if (now.getTime() - time(state.lastErrorAt) < RETRY_MS) return false
  const last = time(state.lastSuccessAt)
  switch (state.frequency) {
    case 'daily':
      return last < lastDailySlot(now, state.dailyTime).getTime()
    case 'change': {
      const change = time(state.lastChangeAt)
      return change > last && now.getTime() - change >= CHANGE_DELAY_MS
    }
    case 'manual':
      return false
  }
}

/** Sem cópia há mais de 3 dias (ou nenhuma ainda). */
export function isStale(lastSuccessAt: string | null, now: Date): boolean {
  return now.getTime() - time(lastSuccessAt) > STALE_MS
}
