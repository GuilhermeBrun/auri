import { z } from 'zod'
import type { DataTopic, IpcResult } from '../shared/api'
import {
  appointmentInputSchema,
  appointmentRangeSchema,
  idSchema,
  patientFilterSchema,
  patientInputSchema
} from '../shared/schemas'
import {
  createAppointment,
  listAppointments,
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
  /** O que muda quando a operação dá certo: vira aviso para as telas abertas (aqui e na rede). */
  changes?: DataTopic[]
}

/** `updated_at` de quando o registro foi aberto na tela (ver `assertUnchanged`). */
const expectedSchema = z
  .string()
  .max(40)
  .nullish()
  .transform((v) => v ?? undefined)

/**
 * Tudo o que as telas podem pedir ao banco. O IPC local e o servidor de rede usam este mesmo
 * registro, então a validação, as regras (ex.: horário ocupado) e as mensagens são as mesmas pelos
 * dois caminhos. Cada entrada valida os argumentos no main: quem chama nunca é tratado como
 * confiável.
 */
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
    // o nome do paciente aparece nas sessões da agenda
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

/**
 * Executa uma operação e devolve o resultado como `IpcResult` (erros viram mensagem legível).
 * `onChange` recebe o que mudou quando uma gravação dá certo.
 */
export function runOperation(
  db: Db,
  channel: string,
  args: unknown[],
  onChange?: (topics: DataTopic[]) => void
): IpcResult<unknown> {
  const operation = Object.hasOwn(OPERATIONS, channel) ? OPERATIONS[channel] : undefined
  if (!operation) return { ok: false, error: 'Operação desconhecida' }
  try {
    const data = operation.run(db, args)
    if (operation.changes) onChange?.(operation.changes)
    return { ok: true, data }
  } catch (error) {
    // Nunca os argumentos nem as mensagens das regras ("Esse horário já está ocupado: <nome>"),
    // que têm dados de pacientes; só o texto de erros do banco (ex.: "database is locked").
    const name = error instanceof Error ? error.name : typeof error
    console.error(`[operação] ${channel}: ${name === 'SqliteError' ? errorMessage(error) : name}`)
    return { ok: false, error: errorMessage(error) }
  }
}
