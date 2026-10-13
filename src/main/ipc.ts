import { ipcMain } from 'electron'
import { z } from 'zod'
import type { IpcResult } from '../shared/api'
import type { Connection } from './connection'
import { DATA_CHANNELS, errorMessage } from './operations'
import type { PrefsStore } from './prefs'

/** Todo handler valida a entrada no main: o renderer nunca é tratado como confiável. */
function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(...(args as A)) }
    } catch (error) {
      console.error(`[ipc] ${channel}: ${errorMessage(error)}`)
      return { ok: false, error: errorMessage(error) }
    }
  })
}

export function registerIpc(connection: Connection, prefs: PrefsStore): void {
  // Dados: no banco deste computador ou no outro, conforme o papel (ver main/connection.ts).
  for (const channel of DATA_CHANNELS) {
    ipcMain.handle(channel, (_event, ...args) => connection.call(channel, args))
  }

  // Configurações / Conexão
  const bool = z.boolean()
  handle('connection:info', () => connection.info())
  handle('connection:setRole', (role: unknown) =>
    connection.setRole(z.enum(['server', 'client']).parse(role))
  )
  handle('connection:setName', (name: unknown) =>
    connection.setName(z.string().trim().min(1, 'Informe um nome').max(60).parse(name))
  )
  handle('connection:setSharing', (on: unknown) => connection.setSharing(bool.parse(on)))
  handle('connection:setKeepRunning', (on: unknown) => connection.setKeepRunning(bool.parse(on)))
  handle('connection:setOpenAtLogin', (on: unknown) => connection.setOpenAtLogin(bool.parse(on)))
  handle('connection:setRemoteAccess', (on: unknown) => connection.setRemoteAccess(bool.parse(on)))
  handle('connection:testRemote', () => connection.testRemote())
  handle('connection:createCode', () => connection.createCode())
  handle('connection:cancelCode', () => connection.cancelCode())
  handle('connection:removeDevice', (key: unknown) =>
    connection.removeDevice(
      z
        .string()
        .regex(/^[0-9a-f]{64}$/)
        .parse(key)
    )
  )
  handle('connection:discover', () => connection.discover())
  handle('connection:pair', (address: unknown, code: unknown) =>
    connection.pair(
      z.string().max(100).parse(address),
      z.string().trim().min(1, 'Digite o código').max(30).parse(code)
    )
  )
  handle('connection:forget', () => connection.forget())
  handle('connection:retry', () => connection.retry())

  // Sem resposta: a janela manda gravar e segue (ver main/prefs.ts)
  ipcMain.on('prefs:save', (_event, value: unknown) => {
    try {
      prefs.save(value)
    } catch (error) {
      console.error('[ipc] prefs:save', error)
    }
  })
}
