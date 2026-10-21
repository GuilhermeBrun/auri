import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { appointmentInputSchema, emptyPatientInput } from '../../shared/schemas'
import {
  createAppointment,
  getAppointment,
  listAppointments,
  removeAppointment,
  updateAppointment
} from './appointments'
import { getClinic, saveClinic } from './clinic'
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
    db.prepare(
      `INSERT INTO appointments (patient_id, inicio, fim) VALUES (?, '2025-09-08T23:45', '2025-09-09T00:15')`
    ).run(patientId)
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

describe('horário de funcionamento', () => {
  it('recusa agendar fora do horário, com o motivo', () => {
    expect(() => createAppointment(db, at('2026-10-18T09:00', '2026-10-18T09:30'))).toThrow(
      'A clínica não abre no domingo.'
    )
    expect(() => createAppointment(db, at('2026-10-24T11:30', '2026-10-24T12:30'))).toThrow(
      'Fora do horário de funcionamento: no sábado, a clínica abre das 07:00 às 12:00.'
    )
    expect(() => createAppointment(db, at('2026-10-19T06:30', '2026-10-19T07:30'))).toThrow(
      /na segunda, a clínica abre das 07:00 às 20:00/
    )
    expect(createAppointment(db, at('2026-10-24T11:30', '2026-10-24T12:00')).inicio).toBe(
      '2026-10-24T11:30'
    )
    expect(createAppointment(db, at('2026-10-19T19:30', '2026-10-19T20:00')).fim).toBe(
      '2026-10-19T20:00'
    )
  })

  it('segue o horário salvo na clínica', () => {
    const { updated_at: _, ...clinic } = getClinic(db)
    saveClinic(db, { ...clinic, funcionamento: { 0: { abre: '08:00', fecha: '10:00' } } })
    expect(createAppointment(db, at('2026-10-18T09:00', '2026-10-18T09:30')).id).toBeGreaterThan(0)
    expect(() => createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))).toThrow(
      'A clínica não abre na segunda.'
    )
  })

  it('edita o que ficou fora do horário sem mexer no horário, e recusa mudar para fora', () => {
    const a = createAppointment(db, at('2026-10-24T11:00', '2026-10-24T11:30'))
    const { updated_at: _, ...clinic } = getClinic(db)
    saveClinic(db, { ...clinic, funcionamento: { 1: { abre: '07:00', fecha: '20:00' } } })
    const anotado = updateAppointment(db, a.id, {
      ...at('2026-10-24T11:00', '2026-10-24T11:30'),
      observacao: 'Trazer exames'
    })
    expect(anotado.observacao).toBe('Trazer exames')
    expect(() => updateAppointment(db, a.id, at('2026-10-24T11:30', '2026-10-24T12:00'))).toThrow(
      'A clínica não abre no sábado.'
    )
  })
})

describe('confirmação', () => {
  it('marca, mantém a hora da confirmação e desmarca', () => {
    const a = createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(a.confirmado_em).toBeNull()

    const confirmado = updateAppointment(db, a.id, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      confirmado: true
    })
    expect(confirmado.confirmado_em).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const remarcado = updateAppointment(db, a.id, {
      ...at('2026-10-19T10:00', '2026-10-19T10:30'),
      confirmado: true
    })
    expect(remarcado.confirmado_em).toBe(confirmado.confirmado_em)

    const semCampo = updateAppointment(db, a.id, at('2026-10-19T10:00', '2026-10-19T10:30'))
    expect(semCampo.confirmado_em).toBe(confirmado.confirmado_em)

    const desmarcado = updateAppointment(db, a.id, {
      ...at('2026-10-19T10:00', '2026-10-19T10:30'),
      confirmado: false
    })
    expect(desmarcado.confirmado_em).toBeNull()
  })

  it('editar sem o campo mantém a evolução; com o campo vazio apaga', () => {
    const a = createAppointment(db, {
      ...at('2025-09-08T14:00', '2025-09-08T14:30'),
      evolucao: 'Respondeu bem.'
    })
    const semCampo = updateAppointment(db, a.id, {
      ...at('2025-09-08T15:00', '2025-09-08T15:30'),
      observacao: 'Remarcado'
    })
    expect(semCampo.evolucao).toBe('Respondeu bem.')

    const vazio = updateAppointment(db, a.id, {
      ...at('2025-09-08T15:00', '2025-09-08T15:30'),
      evolucao: ''
    })
    expect(vazio.evolucao).toBe('')
  })

  it('não exclui a sessão com evolução quando protegida', () => {
    const a = createAppointment(db, {
      ...at('2025-09-08T14:00', '2025-09-08T14:30'),
      evolucao: 'Respondeu bem.'
    })
    expect(() => removeAppointment(db, a.id, true)).toThrow('computador da recepção')
    const b = createAppointment(db, at('2025-09-09T14:00', '2025-09-09T14:30'))
    removeAppointment(db, b.id, true)
    removeAppointment(db, a.id)
    expect(listAppointments(db, '2025-09-08T00:00', '2025-09-10T00:00')).toHaveLength(0)
  })

  it('já nasce confirmado quando pedido', () => {
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      confirmado: true
    })
    expect(a.confirmado_em).not.toBeNull()
    expect(getAppointment(db, a.id).confirmado_em).toBe(a.confirmado_em)
  })
})
