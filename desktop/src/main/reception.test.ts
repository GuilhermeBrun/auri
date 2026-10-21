import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput, type Appointment } from '../shared/schemas'
import { openDatabase, type Db } from './db/connection'
import { createPatient } from './db/patients'
import { runOperation } from './operations'
import { callAsReception, RECEPTION_BLOCKED, RECEPTION_SETTINGS_BLOCKED } from './reception'

let db: Db
let patientId: number

const call = (channel: string, args: unknown[]) => Promise.resolve(runOperation(db, channel, args))

const reception = (channel: string, ...args: unknown[]) => callAsReception(call, channel, args)

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' }).id
})

function sessao(evolucao = ''): Appointment {
  const result = runOperation(db, 'appointments:create', [
    {
      patient_id: patientId,
      inicio: '2025-09-08T14:00',
      fim: '2025-09-08T14:30',
      observacao: '',
      evolucao
    }
  ])
  if (!result.ok) throw new Error(result.error)
  return result.data as Appointment
}

describe('computador da recepção', () => {
  it('não abre a anamnese nem as evoluções', async () => {
    for (const channel of [
      'anamneses:get',
      'anamneses:save',
      'documents:anamnese',
      'documents:evolutions'
    ]) {
      expect(await reception(channel, patientId)).toEqual({ ok: false, error: RECEPTION_BLOCKED })
    }
  })

  it('não muda as configurações da clínica nem do financeiro, mas lê o que precisa', async () => {
    for (const channel of [
      'clinic:save',
      'tipos:save',
      'tipos:remove',
      'terms:saveModel',
      'finance:saveService',
      'finance:savePlan',
      'finance:saveInsurer'
    ]) {
      expect(await reception(channel, null, {})).toEqual({
        ok: false,
        error: RECEPTION_SETTINGS_BLOCKED
      })
    }
    for (const channel of ['clinic:get', 'tipos:list', 'terms:models', 'finance:catalog']) {
      expect(await reception(channel)).toMatchObject({ ok: true })
    }
  })

  it('vê a sessão sem o texto da evolução', async () => {
    sessao('Respondeu bem.')
    const result = await reception('appointments:listByPatient', patientId)
    expect(result.ok && (result.data as Appointment[]).map((a) => a.evolucao)).toEqual([''])
  })

  it('edita a sessão sem apagar a evolução', async () => {
    const a = sessao('Respondeu bem.')
    const result = await reception(
      'appointments:update',
      a.id,
      {
        patient_id: patientId,
        inicio: '2025-09-08T15:00',
        fim: '2025-09-08T15:30',
        observacao: 'Remarcado',
        evolucao: ''
      },
      a.updated_at,
      'Recepção'
    )
    expect(result).toMatchObject({ ok: true })
    const row = db.prepare('SELECT evolucao FROM appointments WHERE id = ?').get(a.id)
    expect(row).toEqual({ evolucao: 'Respondeu bem.' })
  })

  it('não exclui a sessão que tem evolução', async () => {
    const a = sessao('Respondeu bem.')
    const result = await reception('appointments:remove', a.id)
    expect(result.ok).toBe(false)
    expect(db.prepare('SELECT 1 FROM appointments WHERE id = ?').get(a.id)).toBeTruthy()
  })
})
