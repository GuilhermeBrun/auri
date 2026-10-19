import { z } from 'zod'
import type { DataTopic, IpcResult } from '../shared/api'
import {
  anamneseInputSchema,
  appointmentInputSchema,
  appointmentRangeSchema,
  idSchema,
  patientFilterSchema,
  patientInputSchema
} from '../shared/schemas'
import { getAnamnese, saveAnamnese } from './db/anamneses'
import {
  createAppointment,
  listAppointments,
  listPatientAppointments,
  removeAppointment,
  updateAppointment
} from './db/appointments'
import type { Db } from './db/connection'
import {
  createPatient,
  getPatient,
  listPatients,
  setPatientAtivo,
  updatePatient
} from './db/patients'

type Operation = {
  run: (db: Db, args: unknown[]) => unknown
  changes?: DataTopic[]
}

const expectedSchema = z
  .string()
  .max(40)
  .nullish()
  .transform((v) => v ?? undefined)

const OPERATIONS: Record<string, Operation> = {
  'patients:list': {
    run: (db, [filter]) => listPatients(db, patientFilterSchema.parse(filter ?? {}))
  },
  'patients:get': { run: (db, [id]) => getPatient(db, idSchema.parse(id)) },
  'patients:create': {
    run: (db, [input]) => createPatient(db, patientInputSchema.parse(input)),
    changes: ['patients']
  },
  'patients:update': {
    run: (db, [id, input, expected]) =>
      updatePatient(
        db,
        idSchema.parse(id),
        patientInputSchema.parse(input),
        expectedSchema.parse(expected)
      ),
    changes: ['patients', 'appointments']
  },
  'patients:setAtivo': {
    run: (db, [id, ativo]) => setPatientAtivo(db, idSchema.parse(id), z.boolean().parse(ativo)),
    changes: ['patients']
  },

  'appointments:listRange': {
    run: (db, [de, ate]) => {
      const range = appointmentRangeSchema.parse({ de, ate })
      return listAppointments(db, range.de, range.ate)
    }
  },
  'appointments:listByPatient': {
    run: (db, [patientId]) => listPatientAppointments(db, idSchema.parse(patientId))
  },
  'appointments:create': {
    run: (db, [input]) => createAppointment(db, appointmentInputSchema.parse(input)),
    changes: ['appointments']
  },
  'appointments:update': {
    run: (db, [id, input, expected]) =>
      updateAppointment(
        db,
        idSchema.parse(id),
        appointmentInputSchema.parse(input),
        expectedSchema.parse(expected)
      ),
    changes: ['appointments']
  },
  'appointments:remove': {
    run: (db, [id]) => removeAppointment(db, idSchema.parse(id)),
    changes: ['appointments']
  },

  'anamneses:get': { run: (db, [patientId]) => getAnamnese(db, idSchema.parse(patientId)) },
  'anamneses:save': {
    run: (db, [patientId, input, expected]) =>
      saveAnamnese(
        db,
        idSchema.parse(patientId),
        anamneseInputSchema.parse(input),
        expectedSchema.parse(expected)
      ),
    changes: ['anamneses']
  }
}

export const DATA_CHANNELS = Object.keys(OPERATIONS)

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Dados inválidos'
  }
  if (error instanceof Error) {
    if (error.message.includes('FOREIGN KEY')) {
      return 'Operação bloqueada: existem registros ligados a este item.'
    }
    return error.message
  }
  return 'Erro inesperado'
}

export function runOperation(
  db: Db,
  channel: string,
  args: unknown[],
  onChange?: (topics: DataTopic[]) => void,
  onFailure?: (error: unknown) => void
): IpcResult<unknown> {
  const operation = Object.hasOwn(OPERATIONS, channel) ? OPERATIONS[channel] : undefined
  if (!operation) return { ok: false, error: 'Operação desconhecida' }
  try {
    const data = operation.run(db, args)
    if (operation.changes) onChange?.(operation.changes)
    return { ok: true, data }
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error
    console.error(`[operação] ${channel}: ${name === 'SqliteError' ? errorMessage(error) : name}`)
    onFailure?.(error)
    return { ok: false, error: errorMessage(error) }
  }
}
