import type { BackupFrequency } from '../../shared/api'

export const CHANGE_DELAY_MS = 5 * 60_000
export const CHANGE_SPACING_MS = 2 * 60 * 60_000
export const RETRY_MS = 5 * 60_000
export const STALE_MS = 3 * 24 * 60 * 60_000

export type ScheduleState = {
  frequency: BackupFrequency
  dailyTime: string
  lastSuccessAt: string | null
  lastChangeAt: string | null
  lastErrorAt: string | null
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) : -Infinity)

export function lastDailySlot(now: Date, dailyTime: string): Date {
  const [hours, minutes] = dailyTime.split(':').map(Number)
  const slot = new Date(now)
  slot.setHours(hours, minutes, 0, 0)
  if (slot.getTime() > now.getTime()) slot.setDate(slot.getDate() - 1)
  return slot
}

export function isBackupDue(state: ScheduleState, now: Date): boolean {
  if (now.getTime() - time(state.lastErrorAt) < RETRY_MS) return false
  const last = time(state.lastSuccessAt)
  switch (state.frequency) {
    case 'daily':
      return last < lastDailySlot(now, state.dailyTime).getTime()
    case 'change': {
      const change = time(state.lastChangeAt)
      return (
        change > last &&
        now.getTime() - change >= CHANGE_DELAY_MS &&
        now.getTime() - last >= CHANGE_SPACING_MS
      )
    }
    case 'manual':
      return false
  }
}

export function isStale(lastSuccessAt: string | null, now: Date): boolean {
  return now.getTime() - time(lastSuccessAt) > STALE_MS
}
