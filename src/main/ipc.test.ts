import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import type { Connection } from './connection'
import type { BackupService } from './backup-service'
import type { AuriTransfer } from '../shared/api'
import type { PrefsStore } from './prefs'
import { trustRenderer } from './ipc-security'
import { registerIpc } from './ipc'

const { handlers, listeners } = vi.hoisted(() => ({
  handlers: new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>(),
  listeners: new Map<string, (event: IpcMainEvent, ...args: unknown[]) => unknown>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
      handlers.set(name, fn),
    on: (name: string, fn: (event: IpcMainEvent, ...args: unknown[]) => unknown) =>
      listeners.set(name, fn)
  }
}))

const call = vi.fn(() => ({ ok: true, data: [] }))
const save = vi.fn()
const exportSettings = vi.fn(() => 'arquivo fictício')
beforeEach(() => {
  vi.clearAllMocks()
  handlers.clear()
  listeners.clear()
  registerIpc(
    { call } as unknown as Connection,
    { save } as unknown as PrefsStore,
    {} as BackupService,
    { exportSettings } as unknown as AuriTransfer
  )
})

describe('handlers IPC', () => {
  it('todos os canais recusam renderer desconhecido antes de executar a operação', async () => {
    const event = { sender: { id: 9999 } } as IpcMainInvokeEvent
    expect(handlers.size).toBeGreaterThan(20)
    for (const handler of handlers.values())
      expect(await handler(event)).toEqual({ ok: false, error: 'Origem da chamada não autorizada' })
    listeners.get('prefs:save')!(event as unknown as IpcMainEvent, { theme: 'dark' })
    expect(call).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(exportSettings).not.toHaveBeenCalled()
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
    listeners.get('prefs:save')!(event as unknown as IpcMainEvent, { theme: 'dark' })
    expect(save).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' })
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
})
