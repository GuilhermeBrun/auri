import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { appointmentInputSchema, emptyPatientInput } from '../../shared/schemas'
import {
  createAppointment,
  getAppointment,
  listAppointments,
  removeAppointment,
  updateAppointment
} from './appointments'
import { openDatabase, type Db } from './connection'
import { createPatient } from './patients'

let db: Db
let patientId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' }).id
})

function at(
  inicio: string,
  fim: string
): {
  patient_id: number
  inicio: string
  fim: string
  observacao: string
} {
  return { patient_id: patientId, inicio, fim, observacao: '' }
}

describe('agendamentos', () => {
  it('cria com o nome do paciente e lista por intervalo', () => {
    const a = createAppointment(db, at('2025-09-08T14:00', '2025-09-08T14:30'))
    expect(a.patient_nome).toBe('Paciente Fictício')
    createAppointment(db, at('2025-09-10T09:00', '2025-09-10T09:30'))
    createAppointment(db, at('2025-09-15T09:00', '2025-09-15T09:30'))

    const week = listAppointments(db, '2025-09-07T00:00', '2025-09-14T00:00')
    expect(week.map((x) => x.inicio)).toEqual(['2025-09-08T14:00', '2025-09-10T09:00'])
  })

  it('inclui agendamentos que cruzam o limite do intervalo', () => {
    createAppointment(db, at('2025-09-08T23:45', '2025-09-09T00:15'))
    expect(listAppointments(db, '2025-09-09T00:00', '2025-09-10T00:00')).toHaveLength(1)
    expect(listAppointments(db, '2025-09-09T00:15', '2025-09-10T00:00')).toHaveLength(0)
  })

  it('edita e exclui', () => {
    const a = createAppointment(db, at('2025-09-08T14:00', '2025-09-08T14:30'))
    const moved = updateAppointment(db, a.id, {
      ...at('2025-09-08T15:00', '2025-09-08T15:45'),
      observacao: 'Remarcado'
    })
    expect(moved.inicio).toBe('2025-09-08T15:00')
    expect(moved.observacao).toBe('Remarcado')

    removeAppointment(db, a.id)
    expect(listAppointments(db, '2025-09-08T00:00', '2025-09-09T00:00')).toHaveLength(0)
    expect(() => removeAppointment(db, a.id)).toThrow('Agendamento não encontrado')
  })

  it('não agenda para paciente inexistente', () => {
    expect(() =>
      createAppointment(db, { ...at('2025-09-08T14:00', '2025-09-08T14:30'), patient_id: 999 })
    ).toThrow('Paciente não encontrado')
  })

  it('impede apagar paciente que tem agendamento', () => {
    createAppointment(db, at('2025-09-08T14:00', '2025-09-08T14:30'))
    expect(() => db.prepare('DELETE FROM patients WHERE id = ?').run(patientId)).toThrow(
      /FOREIGN KEY/
    )
  })

  describe('horário ocupado', () => {
    let otherId: number

    beforeEach(() => {
      otherId = createPatient(db, { ...emptyPatientInput(), nome: 'Outro Paciente' }).id
      createAppointment(db, at('2025-09-08T14:00', '2025-09-08T15:00'))
    })

    const other = (inicio: string, fim: string): ReturnType<typeof at> => ({
      ...at(inicio, fim),
      patient_id: otherId
    })

    it('recusa o mesmo horário, mesmo para outro paciente, dizendo quem ocupa', () => {
      expect(() => createAppointment(db, other('2025-09-08T14:00', '2025-09-08T15:00'))).toThrow(
        'Esse horário já está ocupado: Paciente Fictício, das 14:00 às 15:00.'
      )
    })

    it.each([
      ['começa no meio de outra', '2025-09-08T14:30', '2025-09-08T15:30'],
      ['termina no meio de outra', '2025-09-08T13:30', '2025-09-08T14:30'],
      ['contém outra', '2025-09-08T13:00', '2025-09-08T16:00'],
      ['está dentro de outra', '2025-09-08T14:15', '2025-09-08T14:45']
    ])('recusa sessão que %s', (_caso, inicio, fim) => {
      expect(() => createAppointment(db, other(inicio, fim))).toThrow(/já está ocupado/)
    })

    it('aceita sessões encostadas e em outro dia', () => {
      createAppointment(db, other('2025-09-08T15:00', '2025-09-08T15:30'))
      createAppointment(db, other('2025-09-08T13:30', '2025-09-08T14:00'))
      createAppointment(db, other('2025-09-09T14:00', '2025-09-09T15:00'))
      expect(listAppointments(db, '2025-09-08T00:00', '2025-09-10T00:00')).toHaveLength(4)
    })

    it('conta as outras sessões que também ocupam o horário', () => {
      createAppointment(db, other('2025-09-08T15:00', '2025-09-08T15:30'))
      expect(() => createAppointment(db, other('2025-09-08T14:30', '2025-09-08T15:15'))).toThrow(
        'Esse horário já está ocupado: Paciente Fictício, das 14:00 às 15:00 e mais 1 sessão.'
      )
    })

    it('ao editar, ignora a própria sessão mas recusa conflito com outra', () => {
      const [own] = listAppointments(db, '2025-09-08T00:00', '2025-09-09T00:00')
      const later = createAppointment(db, other('2025-09-08T16:00', '2025-09-08T16:30'))

      const longer = updateAppointment(db, own.id, at('2025-09-08T14:00', '2025-09-08T15:30'))
      expect(longer.fim).toBe('2025-09-08T15:30')

      expect(() =>
        updateAppointment(db, later.id, other('2025-09-08T15:00', '2025-09-08T16:30'))
      ).toThrow(/já está ocupado/)
      expect(getAppointment(db, later.id).inicio).toBe('2025-09-08T16:00')
    })

    it('libera o horário quando a sessão é excluída', () => {
      const [taken] = listAppointments(db, '2025-09-08T00:00', '2025-09-09T00:00')
      removeAppointment(db, taken.id)
      expect(() =>
        createAppointment(db, other('2025-09-08T14:00', '2025-09-08T15:00'))
      ).not.toThrow()
    })
  })

  it('valida que o fim vem depois do início', () => {
    expect(
      appointmentInputSchema.safeParse(at('2025-09-08T14:30', '2025-09-08T14:00')).success
    ).toBe(false)
    expect(
      appointmentInputSchema.safeParse(at('2025-09-08 14:00', '2025-09-08T14:30')).success
    ).toBe(false)
  })
})
