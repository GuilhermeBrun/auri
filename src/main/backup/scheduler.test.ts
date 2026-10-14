import { describe, expect, it } from 'vite-plus/test'
import { isBackupDue, isStale, lastDailySlot, type ScheduleState } from './scheduler'

const at = (day: number, hours: number, minutes = 0): Date => new Date(2026, 9, day, hours, minutes)
const iso = (date: Date): string => date.toISOString()

function state(change: Partial<ScheduleState>): ScheduleState {
  return {
    frequency: 'daily',
    dailyTime: '19:00',
    lastSuccessAt: null,
    lastChangeAt: null,
    lastErrorAt: null,
    ...change
  }
}

describe('cópia diária', () => {
  it('o último horário é o de hoje depois que ele passa, senão o de ontem', () => {
    expect(lastDailySlot(at(13, 20), '19:00')).toEqual(at(13, 19))
    expect(lastDailySlot(at(13, 9), '19:00')).toEqual(at(12, 19))
  })

  it('copia no horário e não de novo no mesmo dia', () => {
    const copied = state({ lastSuccessAt: iso(at(12, 19)) })
    expect(isBackupDue(copied, at(13, 18, 59))).toBe(false)
    expect(isBackupDue(copied, at(13, 19))).toBe(true)
    expect(isBackupDue(state({ lastSuccessAt: iso(at(13, 19)) }), at(13, 23))).toBe(false)
  })

  it('computador desligado no horário: copia ao abrir na manhã seguinte', () => {
    const copied = state({ lastSuccessAt: iso(at(11, 19)) })
    expect(isBackupDue(copied, at(13, 8))).toBe(true)
  })

  it('nunca copiou: copia já', () => {
    expect(isBackupDue(state({}), at(13, 8))).toBe(true)
  })

  it('depois de uma falha espera 5 minutos', () => {
    const failed = state({ lastErrorAt: iso(at(13, 19, 0)) })
    expect(isBackupDue(failed, at(13, 19, 3))).toBe(false)
    expect(isBackupDue(failed, at(13, 19, 5))).toBe(true)
  })
})

describe('a cada alteração', () => {
  const base = { frequency: 'change' as const, lastSuccessAt: iso(at(13, 10)) }

  it('espera 5 minutos sem mudanças', () => {
    const changed = state({ ...base, lastChangeAt: iso(at(13, 14, 0)) })
    expect(isBackupDue(changed, at(13, 14, 4))).toBe(false)
    expect(isBackupDue(changed, at(13, 14, 5))).toBe(true)
  })

  it('sem mudança depois da última cópia, não copia', () => {
    expect(isBackupDue(state({ ...base, lastChangeAt: iso(at(13, 9)) }), at(13, 20))).toBe(false)
    expect(isBackupDue(state(base), at(13, 20))).toBe(false)
  })
})

describe('só quando pedir', () => {
  it('nunca copia sozinho', () => {
    expect(isBackupDue(state({ frequency: 'manual' }), at(13, 20))).toBe(false)
  })
})

describe('aviso de cópia antiga', () => {
  it('avisa depois de 3 dias sem cópia, ou sem nenhuma', () => {
    expect(isStale(iso(at(10, 19)), at(13, 18))).toBe(false)
    expect(isStale(iso(at(10, 19)), at(13, 20))).toBe(true)
    expect(isStale(null, at(13, 20))).toBe(true)
  })
})
