import { ipcMain } from 'electron'
import { z } from 'zod'
import type { IpcResult } from '../shared/api'
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
import type { PrefsStore } from './prefs'
import {
  createPatient,
  getPatient,
  listPatients,
  setPatientAtivo,
  updatePatient
} from './db/patients'

function errorMessage(error: unknown): string {
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

/** Todo handler valida a entrada no main: o renderer nunca é tratado como confiável. */
function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => T): void {
  ipcMain.handle(channel, (_event, ...args): IpcResult<T> => {
    try {
      return { ok: true, data: fn(...(args as A)) }
    } catch (error) {
      console.error(`[ipc] ${channel}`, error)
      return { ok: false, error: errorMessage(error) }
    }
  })
}

export function registerIpc(db: Db, prefs: PrefsStore): void {
  handle('patients:list', (filter: unknown) =>
    listPatients(db, patientFilterSchema.parse(filter ?? {}))
  )
  handle('patients:get', (id: unknown) => getPatient(db, idSchema.parse(id)))
  handle('patients:create', (input: unknown) => createPatient(db, patientInputSchema.parse(input)))
  handle('patients:update', (id: unknown, input: unknown) =>
    updatePatient(db, idSchema.parse(id), patientInputSchema.parse(input))
  )
  handle('patients:setAtivo', (id: unknown, ativo: unknown) =>
    setPatientAtivo(db, idSchema.parse(id), z.boolean().parse(ativo))
  )

  handle('appointments:listRange', (de: unknown, ate: unknown) => {
    const range = appointmentRangeSchema.parse({ de, ate })
    return listAppointments(db, range.de, range.ate)
  })
  handle('appointments:create', (input: unknown) =>
    createAppointment(db, appointmentInputSchema.parse(input))
  )
  handle('appointments:update', (id: unknown, input: unknown) =>
    updateAppointment(db, idSchema.parse(id), appointmentInputSchema.parse(input))
  )
  handle('appointments:remove', (id: unknown) => removeAppointment(db, idSchema.parse(id)))

  // Sem resposta: a janela manda gravar e segue (ver main/prefs.ts)
  ipcMain.on('prefs:save', (_event, value: unknown) => {
    try {
      prefs.save(value)
    } catch (error) {
      console.error('[ipc] prefs:save', error)
    }
  })
}
