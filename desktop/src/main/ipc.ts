import { app, clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { PHONE_LEVELS, type AuriTransfer, type IpcResult } from '../shared/api'
import type {
  AnamneseDocument,
  AttendanceReport,
  EvolutionReport,
  PatientDocument,
  SignedTermRecord
} from '../shared/schemas'
import { anamneseHtml, anamneseName } from './anamnese-report'
import { attendanceReportHtml, attendanceReportName } from './attendance-report'
import { evolutionReportHtml, evolutionReportName } from './evolution-report'
import { patientHtml, patientName } from './patient-report'
import { termHtml, termPdfName } from './term-report'
import type { Caixa } from './terms/protocol'
import type { BackupService } from './backup-service'
import type { Connection } from './connection'
import type { ErrorReportService } from './error-reports'
import { DATA_CHANNELS, errorMessage } from './operations'
import { uiPrefsSchema } from '../shared/schemas'
import type { PrefsStore } from './prefs'
import { callAsReception, RECEPTION_LOCKED, RECEPTION_STORAGE_BLOCKED } from './reception'
import type { ReceptionLock } from './reception-lock'
import type { UpdateService } from './updates'
import { assertTrustedSender } from './ipc-security'
import { whatsAppUrl, type WhatsAppView } from './whatsapp-view'
import type { LinksCurtos } from './links-curtos'
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
  whatsapp: WhatsAppView
  receptionLock: ReceptionLock
  links?: LinksCurtos
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

const grantSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('computador') }),
  z.object({ tipo: z.literal('celular'), nivel: z.enum(PHONE_LEVELS) })
])

const ENCURTAR = new Set(['terms:send', 'terms:link', 'confirmacoes:enviar'])
const LER_VOLTA = new Set(['terms:check', 'terms:accept', 'confirmacoes:receber'])

export function registerIpc({
  connection,
  prefs,
  backup,
  transfer,
  updates,
  reports,
  inbox,
  whatsapp,
  receptionLock,
  links
}: IpcServices): void {
  const forward = (channel: string, args: unknown[]) => connection.call(channel, args)
  const call = (channel: string, args: unknown[]) =>
    prefs.get().recepcao ? callAsReception(forward, channel, args) : forward(channel, args)

  function handle<A extends unknown[], T>(
    channel: string,
    fn: (...args: A) => T | Promise<T>
  ): void {
    ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
      try {
        assertTrustedSender(event)
        if (prefs.get().recepcao && RECEPTION_LOCKED.has(channel)) {
          throw new Error(RECEPTION_STORAGE_BLOCKED)
        }
        return { ok: true, data: await fn(...(args as A)) }
      } catch (error) {
        console.error(`[ipc] ${channel}: ${errorMessage(error)}`)
        reports.captureUnexpected(error)
        return { ok: false, error: errorMessage(error) }
      }
    })
  }

  for (const channel of DATA_CHANNELS) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        assertTrustedSender(event)
        if (links && LER_VOLTA.has(channel) && typeof args[0] === 'string')
          args[0] = await links.expandir(args[0])
        const result = await call(channel, args)
        if (!links || !ENCURTAR.has(channel) || !result.ok) return result
        return {
          ok: true,
          data: await links.encurtar(result.data as Parameters<typeof links.encurtar>[0])
        }
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
  handle('connection:setNotices', (on: unknown) => connection.setNotices(bool.parse(on)))
  handle('connection:testRemote', () => connection.testRemote())
  handle('connection:createCode', (grant: unknown) =>
    connection.createCode(grantSchema.parse(grant))
  )
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
    const result = await call('attendance:report', [patientId, de, ate])
    if (!result.ok) throw new Error(result.error)
    const report = result.data as AttendanceReport
    const html = attendanceReportHtml(report, { font: await documentFont() })
    return savePdf(await htmlToPdf(html), attendanceReportName(report))
  })

  handle('pdf:evolutions', async (patientId: unknown, de: unknown, ate: unknown) => {
    const result = await call('documents:evolutions', [patientId, de, ate])
    if (!result.ok) throw new Error(result.error)
    const report = result.data as EvolutionReport
    const html = evolutionReportHtml(report, { font: await documentFont() })
    return savePdf(await htmlToPdf(html), evolutionReportName(report))
  })

  handle('pdf:patient', async (patientId: unknown) => {
    const result = await call('documents:patient', [patientId])
    if (!result.ok) throw new Error(result.error)
    const doc = result.data as PatientDocument
    await openPdf(
      await htmlToPdf(patientHtml(doc, { font: await documentFont() })),
      patientName(doc)
    )
  })

  handle('pdf:anamnese', async (patientId: unknown) => {
    const result = await call('documents:anamnese', [patientId])
    if (!result.ok) throw new Error(result.error)
    const doc = result.data as AnamneseDocument
    await openPdf(
      await htmlToPdf(anamneseHtml(doc, { font: await documentFont() })),
      anamneseName(doc)
    )
  })

  handle('pdf:term', async (signedId: unknown) => {
    const result = await call('terms:record', [signedId])
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
    const message = z.string().max(6000).parse(texto)
    const inside = await whatsapp.open(phone, message)
    if (inside) return inside
    if (app.getApplicationNameForProtocol('whatsapp://') !== '') {
      await shell.openExternal(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`)
      return 'pronta'
    }
    const copied = await clipboard.writeText(message).then(
      () => true,
      () => false
    )
    await shell.openExternal(whatsAppUrl(phone))
    return copied ? 'copiada' : 'sem-copia'
  })
  const bounds = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().min(0),
    height: z.number().finite().min(0)
  })
  handle('whatsapp:show', (value: unknown) => whatsapp.show(bounds.parse(value)))
  handle('whatsapp:hide', () => whatsapp.hide())
  handle('whatsapp:unread', () => whatsapp.unread())
  handle('terms:takeIncoming', () => inbox.retirar())
  handle('confirmacoes:takeIncoming', () => inbox.retirarConfirmacoes())

  handle('backup:info', () => backup.info())
  handle('backup:providers', () => backup.providers())
  handle('backup:check', () => backup.check())
  const providerId = z.enum(['google', 'onedrive', 'icloud'])
  handle('backup:install', (id: unknown) => backup.install(providerId.parse(id)))
  handle('backup:openProvider', (id: unknown) => backup.openProvider(providerId.parse(id)))
  handle('backup:chooseFolder', () => backup.chooseFolder())
  handle('backup:setup', (destination: unknown, password: unknown, replace: unknown) =>
    backup.setup(
      destinationSchema.parse(destination),
      passwordSchema.parse(password),
      bool.optional().parse(replace)
    )
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

  handle('reception:enable', (password: unknown) =>
    receptionLock.enable(passwordSchema.optional().parse(password))
  )
  handle('reception:disable', (secret: unknown) =>
    receptionLock.disable(secretSchema.optional().parse(secret))
  )

  const rendererPrefs = uiPrefsSchema.omit({ recepcao: true }).partial()
  ipcMain.on('prefs:save', (event, value: unknown) => {
    try {
      assertTrustedSender(event)
      prefs.save(rendererPrefs.parse(value))
    } catch (error) {
      console.error('[ipc] prefs:save', error)
    }
  })
}
