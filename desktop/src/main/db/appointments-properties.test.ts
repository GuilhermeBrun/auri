import fc from 'fast-check'
import { expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { createAppointment, getAppointment, updateAppointment } from './appointments'
import { openDatabase } from './connection'
import { createPatient } from './patients'

const time = (minutes: number): string =>
  `2026-10-14T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

it('intervalos gerados rejeitam sobreposição, aceitam adjacência e preservam edição recusada', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 420, max: 1100 }),
      fc.integer({ min: 5, max: 90 }),
      fc.integer({ min: 420, max: 1100 }),
      fc.integer({ min: 5, max: 90 }),
      (start, duration, nextStart, nextDuration) => {
        const db = openDatabase(':memory:')
        try {
          const patient = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' })
          const first = createAppointment(db, {
            patient_id: patient.id,
            inicio: time(start),
            fim: time(start + duration),
            observacao: 'Original'
          })
          const next = {
            patient_id: patient.id,
            inicio: time(nextStart),
            fim: time(nextStart + nextDuration),
            observacao: 'Tentativa'
          }
          const overlap =
            Math.max(start, nextStart) < Math.min(start + duration, nextStart + nextDuration)
          if (overlap) {
            expect(() => createAppointment(db, next)).toThrow('ocupado')
            const adjacent = createAppointment(db, {
              ...next,
              inicio: time(start + duration),
              fim: time(start + duration + 5)
            })
            expect(() => updateAppointment(db, adjacent.id, next)).toThrow('ocupado')
            expect(getAppointment(db, adjacent.id)).toEqual(adjacent)
          } else {
            expect(createAppointment(db, next).inicio).toBe(next.inicio)
          }
          expect(getAppointment(db, first.id)).toEqual(first)
          expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
        } finally {
          db.close()
        }
      }
    ),
    { seed: 20261014, numRuns: 250 }
  )
})
