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
import type { CommitmentInput } from '../shared/commitments'
import {
  vagaSchema,
  type SugestaoPedido,
  type Vaga,
  type WaitlistAdd,
  type WaitlistClose,
  type WaitlistInput
} from '../shared/waitlist'
import { etiquetaInputSchema, tipoInputSchema } from '../shared/tipos'
import {
  billingInputSchema,
  chargeInputSchema,
  estornoMotivoSchema,
  financeRangeSchema,
  insurerInputSchema,
  lancamentoSchema,
  packageInputSchema,
  paymentInputSchema,
  planInputSchema,
  serviceInputSchema
} from '../shared/finance'
import { getAnamnese, saveAnamnese } from './db/anamneses'
import {
  createCommitment,
  listCommitments,
  removeCommitment,
  scheduleOnReserve,
  updateCommitment
} from './db/commitments'
import { suggestSlots, whoFits } from './db/encaixe'
import {
  addToWaitlist,
  closeWaitlist,
  getPatientWaitlist,
  listWaitlist,
  updateWaitlist
} from './db/waitlist'
import { attendanceReport, listPatientAttendance, signArrival, voidArrival } from './db/attendance'
import { getClinic, saveClinic } from './db/clinic'
import { anamneseDocument, evolutionReport, patientDocument } from './db/documents'
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
  archiveEtiqueta,
  archiveTipo,
  listEtiquetas,
  listTipos,
  saveEtiqueta,
  saveTipo
} from './db/tipos'
import {
  createAppointment,
  moveAppointment,
  listAppointments,
  listPatientAppointments,
  removeAppointment,
  updateAppointment
} from './db/appointments'
import type { Db } from './db/connection'
import {
  addCharge,
  addPayment,
  archiveInsurer,
  archivePlan,
  archiveService,
  cobrarFalta,
  contractPackage,
  estornar,
  getCatalog,
  getOverview,
  getPatientFinance,
  lancarSessao,
  saveInsurer,
  savePlan,
  saveService,
  setBilling,
  situacaoSessoes
} from './db/finance'
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

function pickSlot(value: unknown): { inicio: string; fim: string } {
  const { inicio, fim } = vagaSchema.parse(value)
  return { inicio, fim }
}

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
    changes: ['appointments', 'waitlist']
  },
  'appointments:move': {
    run: (db, [id, slot, expected]) =>
      moveAppointment(db, idSchema.parse(id), pickSlot(slot), expectedSchema.parse(expected)),
    changes: ['appointments']
  },
  'appointments:scheduleOnReserve': {
    run: (db, [reserveId, input]) =>
      scheduleOnReserve(db, idSchema.parse(reserveId), appointmentInputSchema.parse(input)),
    changes: ['appointments', 'commitments', 'waitlist']
  },

  'commitments:listRange': {
    run: (db, [de, ate]) => {
      const range = appointmentRangeSchema.parse({ de, ate })
      return listCommitments(db, range.de, range.ate)
    }
  },
  'commitments:create': {
    run: (db, [input]) => createCommitment(db, input as CommitmentInput),
    changes: ['commitments']
  },
  'commitments:update': {
    run: (db, [id, input, expected]) =>
      updateCommitment(
        db,
        idSchema.parse(id),
        input as CommitmentInput,
        expectedSchema.parse(expected)
      ),
    changes: ['commitments']
  },
  'commitments:remove': {
    run: (db, [id]) => removeCommitment(db, idSchema.parse(id)),
    changes: ['commitments']
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
    changes: ['appointments', 'attendance', 'finance']
  },
  'attendance:void': {
    run: (db, [signatureId, motivo, computador]) =>
      voidArrival(
        db,
        idSchema.parse(signatureId),
        voidMotivoSchema.parse(motivo),
        computadorSchema.parse(computador)
      ),
    changes: ['appointments', 'attendance', 'finance']
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

  'documents:evolutions': {
    run: (db, [patientId, de, ate]) => {
      const range = reportRangeSchema.parse({ de, ate })
      return evolutionReport(db, idSchema.parse(patientId), range.de, range.ate)
    }
  },
  'documents:patient': { run: (db, [patientId]) => patientDocument(db, idSchema.parse(patientId)) },
  'documents:anamnese': {
    run: (db, [patientId]) => anamneseDocument(db, idSchema.parse(patientId))
  },

  'clinic:get': { run: (db) => getClinic(db) },
  'clinic:save': {
    run: (db, [input, expected]) =>
      saveClinic(db, clinicInputSchema.parse(input), expectedSchema.parse(expected)),
    changes: ['clinic']
  },

  'tipos:list': { run: (db) => listTipos(db) },
  'tipos:save': {
    run: (db, [id, input]) =>
      saveTipo(db, idSchema.nullable().parse(id), tipoInputSchema.parse(input)),
    changes: ['types', 'appointments']
  },
  'tipos:archive': {
    run: (db, [id, arquivado]) => archiveTipo(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['types']
  },
  'etiquetas:list': { run: (db) => listEtiquetas(db) },
  'etiquetas:save': {
    run: (db, [id, input]) =>
      saveEtiqueta(db, idSchema.nullable().parse(id), etiquetaInputSchema.parse(input)),
    changes: ['types', 'appointments']
  },
  'etiquetas:archive': {
    run: (db, [id, arquivado]) =>
      archiveEtiqueta(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['types']
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
  },

  'waitlist:list': { run: (db) => listWaitlist(db) },
  'waitlist:getByPatient': {
    run: (db, [patientId]) => getPatientWaitlist(db, idSchema.parse(patientId))
  },
  'waitlist:add': {
    run: (db, [input]) => addToWaitlist(db, input as WaitlistAdd),
    changes: ['waitlist']
  },
  'waitlist:update': {
    run: (db, [id, input, expected]) =>
      updateWaitlist(
        db,
        idSchema.parse(id),
        input as WaitlistInput,
        expectedSchema.parse(expected)
      ),
    changes: ['waitlist']
  },
  'waitlist:close': {
    run: (db, [id, close]) => closeWaitlist(db, idSchema.parse(id), close as WaitlistClose),
    changes: ['waitlist']
  },
  'encaixe:sugerir': {
    run: (db, [input]) => suggestSlots(db, input as SugestaoPedido, new Date())
  },
  'encaixe:quemCabe': { run: (db, [vaga]) => whoFits(db, vaga as Vaga) },
  'finance:catalog': { run: (db) => getCatalog(db) },
  'finance:saveService': {
    run: (db, [id, input]) =>
      saveService(db, idSchema.nullable().parse(id), serviceInputSchema.parse(input)),
    changes: ['finance']
  },
  'finance:archiveService': {
    run: (db, [id, arquivado]) =>
      archiveService(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['finance']
  },
  'finance:savePlan': {
    run: (db, [id, input]) =>
      savePlan(db, idSchema.nullable().parse(id), planInputSchema.parse(input)),
    changes: ['finance']
  },
  'finance:archivePlan': {
    run: (db, [id, arquivado]) => archivePlan(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['finance']
  },
  'finance:saveInsurer': {
    run: (db, [id, input]) =>
      saveInsurer(db, idSchema.nullable().parse(id), insurerInputSchema.parse(input)),
    changes: ['finance']
  },
  'finance:archiveInsurer': {
    run: (db, [id, arquivado]) =>
      archiveInsurer(db, idSchema.parse(id), z.boolean().parse(arquivado)),
    changes: ['finance']
  },
  'finance:patient': {
    run: (db, [patientId]) => getPatientFinance(db, idSchema.parse(patientId))
  },
  'finance:setBilling': {
    run: (db, [patientId, input, expected]) =>
      setBilling(
        db,
        idSchema.parse(patientId),
        billingInputSchema.parse(input),
        expectedSchema.parse(expected)
      ),
    changes: ['finance']
  },
  'finance:contractPackage': {
    run: (db, [patientId, input, computador]) =>
      contractPackage(
        db,
        idSchema.parse(patientId),
        packageInputSchema.parse(input),
        computadorSchema.parse(computador)
      ),
    changes: ['finance']
  },
  'finance:charge': {
    run: (db, [patientId, input, computador]) =>
      addCharge(
        db,
        idSchema.parse(patientId),
        chargeInputSchema.parse(input),
        computadorSchema.parse(computador)
      ),
    changes: ['finance']
  },
  'finance:pay': {
    run: (db, [patientId, input, computador]) =>
      addPayment(
        db,
        idSchema.parse(patientId),
        paymentInputSchema.parse(input),
        computadorSchema.parse(computador)
      ),
    changes: ['finance']
  },
  'finance:launchSession': {
    run: (db, [appointmentId, computador, serviceId]) =>
      lancarSessao(
        db,
        idSchema.parse(appointmentId),
        computadorSchema.parse(computador),
        idSchema.nullish().parse(serviceId) ?? null
      ),
    changes: ['finance']
  },
  'finance:chargeAbsence': {
    run: (db, [appointmentId, computador]) =>
      cobrarFalta(db, idSchema.parse(appointmentId), computadorSchema.parse(computador)),
    changes: ['finance']
  },
  'finance:void': {
    run: (db, [kind, id, motivo, computador]) =>
      estornar(
        db,
        lancamentoSchema.parse(kind),
        idSchema.parse(id),
        estornoMotivoSchema.parse(motivo),
        computadorSchema.parse(computador)
      ),
    changes: ['finance']
  },
  'finance:sessionStatus': {
    run: (db, [ids]) => situacaoSessoes(db, z.array(idSchema).max(500).parse(ids))
  },
  'finance:overview': {
    run: (db, [de, ate]) => {
      const range = financeRangeSchema.parse({ de, ate })
      return getOverview(db, range.de, range.ate)
    }
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
