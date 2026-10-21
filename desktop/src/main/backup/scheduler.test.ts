import { describe, expect, it } from 'vite-plus/test'
import {
  isBackupDue,
  isBackupDueOnQuit,
  isStale,
  lastDailySlot,
  type ScheduleState
} from './scheduler'

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

  it('no máximo uma cópia por hora, e a última alteração sai depois', () => {
    const recent = state({
      frequency: 'change',
      lastSuccessAt: iso(at(13, 14, 0)),
      lastChangeAt: iso(at(13, 14, 20))
    })
    expect(isBackupDue(recent, at(13, 14, 30))).toBe(false)
    expect(isBackupDue(recent, at(13, 14, 59))).toBe(false)
    expect(isBackupDue(recent, at(13, 15, 0))).toBe(true)
  })

  it('sem mudança depois da última cópia, não copia', () => {
    expect(isBackupDue(state({ ...base, lastChangeAt: iso(at(13, 9)) }), at(13, 20))).toBe(false)
    expect(isBackupDue(state(base), at(13, 20))).toBe(false)
  })
})

describe('ao sair do Auri', () => {
  it('a cada alteração: copia o que mudou, sem esperar o intervalo nem os 5 minutos', () => {
    const pending = state({
      frequency: 'change',
      lastSuccessAt: iso(at(13, 18, 30)),
      lastChangeAt: iso(at(13, 18, 59))
    })
    expect(isBackupDue(pending, at(13, 19))).toBe(false)
    expect(isBackupDueOnQuit(pending, at(13, 19))).toBe(true)
  })

  it('a cada alteração: nada mudou depois da última cópia, sai direto', () => {
    const saved = state({
      frequency: 'change',
      lastSuccessAt: iso(at(13, 18, 30)),
      lastChangeAt: iso(at(13, 18))
    })
    expect(isBackupDueOnQuit(saved, at(13, 19))).toBe(false)
    expect(isBackupDueOnQuit(state({ frequency: 'change' }), at(13, 19))).toBe(false)
  })

  it('todo dia: copia só se a cópia do horário ainda não saiu', () => {
    expect(isBackupDueOnQuit(state({ lastSuccessAt: iso(at(12, 19)) }), at(13, 20))).toBe(true)
    expect(isBackupDueOnQuit(state({ lastSuccessAt: iso(at(12, 19)) }), at(13, 18))).toBe(false)
  })

  it('ignora a espera depois de uma falha', () => {
    const failed = state({
      frequency: 'change',
      lastSuccessAt: iso(at(13, 10)),
      lastChangeAt: iso(at(13, 18)),
      lastErrorAt: iso(at(13, 18, 58))
    })
    expect(isBackupDueOnQuit(failed, at(13, 19))).toBe(true)
  })

  it('só quando pedir: nunca copia ao sair', () => {
    expect(isBackupDueOnQuit(state({ frequency: 'manual' }), at(13, 20))).toBe(false)
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
