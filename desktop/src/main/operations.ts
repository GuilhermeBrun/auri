import { z } from 'zod'
import type { DataTopic, IpcResult } from '../shared/api'
import {
  anamneseInputSchema,
  appointmentInputSchema,
  appointmentRangeSchema,
  arrivalSignInputSchema,
  clinicInputSchema,
  computadorSchema,
  termModelInputSchema,
  termSendInputSchema,
  idSchema,
  patientFilterSchema,
  patientInputSchema,
  reportRangeSchema,
  voidMotivoSchema
} from '../shared/schemas'
import { getAnamnese, saveAnamnese } from './db/anamneses'
import { attendanceReport, listPatientAttendance, signArrival, voidArrival } from './db/attendance'
import { getClinic, saveClinic } from './db/clinic'
import {
  acceptResponse,
  cancelTerm,
  checkResponse,
  listModels,
  listPatientTerms,
  measureModel,
  saveModel,
  sendTerm,
  setModelArchived,
  signedTermRecord,
  termLink
} from './db/terms'
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

const responseText = z.string().max(20_000)

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

  'attendance:sign': {
    run: (db, [appointmentId, input, computador]) =>
      signArrival(
        db,
        idSchema.parse(appointmentId),
        arrivalSignInputSchema.parse(input),
        computadorSchema.parse(computador)
      ),
    changes: ['appointments', 'attendance']
  },
  'attendance:void': {
    run: (db, [signatureId, motivo, computador]) =>
      voidArrival(
        db,
        idSchema.parse(signatureId),
        voidMotivoSchema.parse(motivo),
        computadorSchema.parse(computador)
      ),
    changes: ['appointments', 'attendance']
  },
  'attendance:listByPatient': {
    run: (db, [patientId]) => listPatientAttendance(db, idSchema.parse(patientId))
  },
  'attendance:report': {
    run: (db, [patientId, de, ate]) => {
      const range = reportRangeSchema.parse({ de, ate })
      return attendanceReport(db, idSchema.parse(patientId), range.de, range.ate)
    }
  },

  'clinic:get': { run: (db) => getClinic(db) },
  'clinic:save': {
    run: (db, [input, expected]) =>
      saveClinic(db, clinicInputSchema.parse(input), expectedSchema.parse(expected)),
    changes: ['clinic']
  },

  'terms:models': { run: (db) => listModels(db) },
  'terms:measureModel': {
    run: (db, [input]) => measureModel(db, termModelInputSchema.parse(input))
  },
  'terms:saveModel': {
    run: (db, [id, input]) =>
      saveModel(db, idSchema.nullable().parse(id), termModelInputSchema.parse(input)),
    changes: ['terms']
  },
  'terms:archiveModel': {
    run: (db, [id, arquivado]) =>
      setModelArchived(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['terms']
  },
  'terms:listByPatient': {
    run: (db, [patientId]) => listPatientTerms(db, idSchema.parse(patientId))
  },
  'terms:send': {
    run: (db, [patientId, input, computador]) =>
      sendTerm(
        db,
        idSchema.parse(patientId),
        termSendInputSchema.parse(input),
        computadorSchema.parse(computador)
      ),
    changes: ['terms']
  },
  'terms:link': { run: (db, [requestId]) => termLink(db, idSchema.parse(requestId)) },
  'terms:cancel': {
    run: (db, [requestId]) => cancelTerm(db, idSchema.parse(requestId)),
    changes: ['terms']
  },
  'terms:check': { run: (db, [texto]) => checkResponse(db, responseText.parse(texto)) },
  'terms:accept': {
    run: (db, [texto, computador]) =>
      acceptResponse(db, responseText.parse(texto), computadorSchema.parse(computador)),
    changes: ['terms']
  },
  'terms:record': { run: (db, [signedId]) => signedTermRecord(db, idSchema.parse(signedId)) },

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
