import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import type { Connection } from './connection'
import type { BackupService } from './backup-service'
import type { ErrorReportService } from './error-reports'
import { DEFAULT_UI_PREFS, type AuriTransfer } from '../shared/api'
import type { PrefsStore } from './prefs'
import type { UpdateService } from './updates'
import { trustRenderer } from './ipc-security'
import { registerIpc } from './ipc'

const { handlers, listeners } = vi.hoisted(() => ({
  handlers: new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>(),
  listeners: new Map<string, (event: IpcMainEvent, ...args: unknown[]) => unknown>()
}))
vi.mock('electron', () => ({
  app: { getApplicationNameForProtocol: () => '' },
  shell: { openExternal: vi.fn() },
  clipboard: { writeText: vi.fn() },
  ipcMain: {
    handle: (name: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
      handlers.set(name, fn),
    on: (name: string, fn: (event: IpcMainEvent, ...args: unknown[]) => unknown) =>
      listeners.set(name, fn)
  }
}))

const call = vi.fn(() => ({ ok: true, data: [] }))
const save = vi.fn()
const capture = vi.fn()
const captureUnexpected = vi.fn()
const exportSettings = vi.fn(() => 'arquivo fictício')
const openWhatsApp = vi.fn(() => true)
const checkUpdates = vi.fn(() => ({ status: 'checking' }))
const installUpdate = vi.fn(() => {
  throw new Error('Nenhuma versão nova pronta.')
})
beforeEach(() => {
  vi.clearAllMocks()
  handlers.clear()
  listeners.clear()
  registerIpc({
    connection: { call } as unknown as Connection,
    prefs: { save, get: () => DEFAULT_UI_PREFS } as unknown as PrefsStore,
    backup: {} as BackupService,
    transfer: { exportSettings } as unknown as AuriTransfer,
    updates: { check: checkUpdates, install: installUpdate } as unknown as UpdateService,
    reports: { capture, captureUnexpected } as unknown as ErrorReportService,
    inbox: { receber: () => false, retirar: () => [], retirarConfirmacoes: () => [] },
    whatsapp: {
      open: openWhatsApp,
      attach: vi.fn(),
      setEnabled: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      unread: () => 0
    },
    receptionLock: { enable: vi.fn(), disable: vi.fn() }
  })
})

describe('handlers IPC', () => {
  it('todos os canais recusam renderer desconhecido antes de executar a operação', async () => {
    const event = { sender: { id: 9999 } } as IpcMainInvokeEvent
    expect(handlers.size).toBeGreaterThan(20)
    for (const handler of handlers.values())
      expect(await handler(event)).toEqual({ ok: false, error: 'Origem da chamada não autorizada' })
    listeners.get('prefs:save')!(event as unknown as IpcMainEvent, { theme: 'dark' })
    listeners.get('reports:error')!(event as unknown as IpcMainEvent, { name: 'TypeError' })
    expect(call).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
    expect(exportSettings).not.toHaveBeenCalled()
    expect(checkUpdates).not.toHaveBeenCalled()
    expect(installUpdate).not.toHaveBeenCalled()
    expect(openWhatsApp).not.toHaveBeenCalled()
  })
  it('janela autorizada usa a API, mas um subframe não pode ler dados nem gravar preferências', async () => {
    const mainFrame = { url: 'file:///auri/out/renderer/index.html#/pacientes' }
    const sender = {
      id: 300,
      mainFrame,
      isDestroyed: () => false,
      once: () => undefined
    } as unknown as WebContents
    trustRenderer(sender, 'file:///auri/out/renderer/index.html')
    const event = { sender, senderFrame: mainFrame } as IpcMainInvokeEvent
    expect(await handlers.get('patients:list')!(event, {})).toEqual({ ok: true, data: [] })
    expect(call).toHaveBeenCalledExactlyOnceWith('patients:list', [{}])
    expect(await handlers.get('transfer:export')!(event)).toEqual({
      ok: true,
      data: 'arquivo fictício'
    })
    expect(await handlers.get('updates:check')!(event)).toEqual({
      ok: true,
      data: { status: 'checking' }
    })
    expect(await handlers.get('updates:setChannel')!(event, 'nightly')).toMatchObject({ ok: false })
    expect(await handlers.get('updates:install')!(event)).toEqual({
      ok: false,
      error: 'Nenhuma versão nova pronta.'
    })
    expect(captureUnexpected).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Nenhuma versão nova pronta.' })
    )
    listeners.get('prefs:save')!(event as unknown as IpcMainEvent, { theme: 'dark' })
    expect(save).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' })
    listeners.get('prefs:save')!(event as unknown as IpcMainEvent, { recepcao: false })
    expect(save).toHaveBeenLastCalledWith({})
    const crash = {
      name: 'TypeError',
      message: 'x is not a function',
      stack: 'TypeError\n    at y'
    }
    listeners.get('reports:error')!(event as unknown as IpcMainEvent, crash)
    expect(capture).toHaveBeenCalledExactlyOnceWith('renderer', crash)
    listeners.get('reports:error')!(event as unknown as IpcMainEvent, { stack: 'x'.repeat(30_000) })
    expect(capture).toHaveBeenLastCalledWith('renderer', { stack: 'x'.repeat(20_000) })
    vi.clearAllMocks()
    const subframe = { ...event, senderFrame: { url: mainFrame.url } } as IpcMainInvokeEvent
    expect(await handlers.get('patients:list')!(subframe)).toEqual({
      ok: false,
      error: 'Origem da chamada não autorizada'
    })
    listeners.get('prefs:save')!(subframe as unknown as IpcMainEvent, { theme: 'dark' })
    expect(call).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
  it('abre a conversa na janela do WhatsApp só com número e texto válidos', async () => {
    const mainFrame = { url: 'file:///auri/out/renderer/index.html' }
    const sender = {
      id: 301,
      mainFrame,
      isDestroyed: () => false,
      once: () => undefined
    } as unknown as WebContents
    trustRenderer(sender, mainFrame.url)
    const event = { sender, senderFrame: mainFrame } as IpcMainInvokeEvent
    const open = handlers.get('terms:openWhatsApp')!
    expect(await open(event, '5565900000000', 'Olá')).toEqual({ ok: true, data: undefined })
    expect(openWhatsApp).toHaveBeenCalledExactlyOnceWith('5565900000000', 'Olá')
    for (const [numero, texto] of [
      ['65 90000-0000', 'Olá'],
      ['123', 'Olá'],
      ['5565900000000', 'x'.repeat(6001)],
      ['5565900000000', 42]
    ])
      expect(await open(event, numero, texto)).toMatchObject({ ok: false })
    expect(openWhatsApp).toHaveBeenCalledTimes(1)
  })
})
