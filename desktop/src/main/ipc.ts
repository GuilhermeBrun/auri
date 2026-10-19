import { app, clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import type { AuriTransfer, IpcResult } from '../shared/api'
import type { AttendanceReport, SignedTermRecord } from '../shared/schemas'
import { attendanceReportHtml, attendanceReportName } from './attendance-report'
import { termHtml, termPdfName } from './term-report'
import type { Caixa } from './terms/protocol'
import type { BackupService } from './backup-service'
import type { Connection } from './connection'
import type { ErrorReportService } from './error-reports'
import { DATA_CHANNELS, errorMessage } from './operations'
import type { PrefsStore } from './prefs'
import type { UpdateService } from './updates'
import { assertTrustedSender } from './ipc-security'
import { chooseLogo } from './logo'
import { documentFont, htmlToPdf, openPdf, savePdf } from './pdf'

export type IpcServices = {
  connection: Connection
  prefs: PrefsStore
  backup: BackupService
  transfer: AuriTransfer
  updates: UpdateService
  reports: ErrorReportService
  inbox: Caixa
}

const cut = (max: number) =>
  z
    .string()
    .transform((value) => value.slice(0, max))
    .optional()

const rendererError = z.object({ name: cut(200), message: cut(2000), stack: cut(20_000) })

const destinationSchema = z.object({
  kind: z.enum(['google', 'onedrive', 'icloud', 'folder']),
  folder: z.string().min(1).max(1000)
})
const passwordSchema = z.string().max(200)
const secretSchema = z.union([
  z.object({ password: passwordSchema }),
  z.object({ recoveryCode: z.string().max(100) })
])

export function registerIpc({
  connection,
  prefs,
  backup,
  transfer,
  updates,
  reports,
  inbox
}: IpcServices): void {
  function handle<A extends unknown[], T>(
    channel: string,
    fn: (...args: A) => T | Promise<T>
  ): void {
    ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
      try {
        assertTrustedSender(event)
        return { ok: true, data: await fn(...(args as A)) }
      } catch (error) {
        console.error(`[ipc] ${channel}: ${errorMessage(error)}`)
        reports.captureUnexpected(error)
        return { ok: false, error: errorMessage(error) }
      }
    })
  }

  for (const channel of DATA_CHANNELS) {
    ipcMain.handle(channel, (event, ...args) => {
      try {
        assertTrustedSender(event)
        return connection.call(channel, args)
      } catch (error) {
        return { ok: false, error: errorMessage(error) }
      }
    })
  }

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

  handle('clinic:chooseLogo', () => chooseLogo())
  handle('pdf:attendance', async (patientId: unknown, de: unknown, ate: unknown) => {
    const result = await connection.call('attendance:report', [patientId, de, ate])
    if (!result.ok) throw new Error(result.error)
    const report = result.data as AttendanceReport
    const html = attendanceReportHtml(report, { font: await documentFont() })
    return savePdf(await htmlToPdf(html), attendanceReportName(report))
  })

  handle('pdf:term', async (signedId: unknown) => {
    const result = await connection.call('terms:record', [signedId])
    if (!result.ok) throw new Error(result.error)
    const record = result.data as SignedTermRecord
    await openPdf(
      await htmlToPdf(termHtml(record, { font: await documentFont() })),
      termPdfName(record)
    )
  })
  handle('terms:openWhatsApp', async (numero: unknown, texto: unknown) => {
    const phone = z
      .string()
      .regex(/^\d{10,15}$/)
      .parse(numero)
    const text = encodeURIComponent(z.string().max(6000).parse(texto))
    const desktop = app.getApplicationNameForProtocol('whatsapp://') !== ''
    await shell.openExternal(
      desktop
        ? `whatsapp://send?phone=${phone}&text=${text}`
        : `https://wa.me/${phone}?text=${text}`
    )
  })
  handle('terms:takeIncoming', () => inbox.retirar())

  handle('backup:info', () => backup.info())
  handle('backup:providers', () => backup.providers())
  handle('backup:check', () => backup.check())
  const providerId = z.enum(['google', 'onedrive', 'icloud'])
  handle('backup:install', (id: unknown) => backup.install(providerId.parse(id)))
  handle('backup:openProvider', (id: unknown) => backup.openProvider(providerId.parse(id)))
  handle('backup:chooseFolder', () => backup.chooseFolder())
  handle('backup:setup', (destination: unknown, password: unknown) =>
    backup.setup(destinationSchema.parse(destination), passwordSchema.parse(password))
  )
  handle('backup:setDestination', (destination: unknown) =>
    backup.setDestination(destinationSchema.parse(destination))
  )
  handle('backup:setFrequency', (frequency: unknown, time: unknown) =>
    backup.setFrequency(
      z.enum(['daily', 'change', 'manual']).parse(frequency),
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .parse(time)
    )
  )
  handle('backup:runNow', () => backup.runNow())
  handle('backup:openFolder', () => backup.openFolder())
  handle('backup:changePassword', (current: unknown, next: unknown) =>
    backup.changePassword(passwordSchema.parse(current), passwordSchema.parse(next))
  )
  handle('backup:resetPassword', (code: unknown, next: unknown) =>
    backup.resetPassword(z.string().max(100).parse(code), passwordSchema.parse(next))
  )
  handle('backup:newRecoveryCode', (password: unknown) =>
    backup.newRecoveryCode(passwordSchema.parse(password))
  )
  handle('backup:printRecoveryCode', (code: unknown) =>
    backup.printRecoveryCode(z.string().max(100).parse(code))
  )
  handle('backup:disable', () => backup.disable())
  handle('backup:list', () => backup.list())
  handle('backup:pickFile', () => backup.pickFile())
  handle('backup:restore', (file: unknown, secret: unknown) =>
    backup.restore(z.string().max(1000).parse(file), secretSchema.optional().parse(secret))
  )
  handle('backup:undoRestore', () => backup.undoRestore())
  handle('backup:dismissWelcome', () => backup.dismissWelcome())

  handle('transfer:export', () => transfer.exportSettings())
  handle('transfer:pick', () => transfer.pickSettings())
  handle('transfer:apply', (token: unknown) =>
    transfer.applySettings(z.string().uuid().parse(token))
  )

  handle('updates:info', () => updates.info())
  handle('updates:check', () => updates.check())
  handle('updates:install', () => updates.install())
  handle('updates:setChannel', (channel: unknown) =>
    updates.setChannel(z.enum(['latest', 'alpha']).parse(channel))
  )

  handle('reports:info', () => reports.info())
  handle('reports:setEnabled', (on: unknown) => reports.setEnabled(bool.parse(on)))
  handle('reports:copy', () => clipboard.writeText(reports.text()))
  ipcMain.on('reports:error', (event, value: unknown) => {
    try {
      assertTrustedSender(event)
      reports.capture('renderer', rendererError.parse(value))
    } catch (error) {
      console.error('[ipc] reports:error', errorMessage(error))
    }
  })

  ipcMain.on('prefs:save', (event, value: unknown) => {
    try {
      assertTrustedSender(event)
      prefs.save(value)
    } catch (error) {
      console.error('[ipc] prefs:save', error)
    }
  })
}
