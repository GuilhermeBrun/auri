import { readFileSync } from 'node:fs'
import type { UpdateChannel, UpdateState } from '../shared/api'
import { writeAtomicJson } from './atomic-file'

export function hasTeamIdentifier(codesignOutput: string): boolean {
  return /^TeamIdentifier=(?!not set$)\S+$/m.test(codesignOutput)
}

export interface Updater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  channel: string | null
  allowPrerelease: boolean
  allowDowngrade: boolean
  checkForUpdates: () => Promise<unknown>
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void
  on(
    event: 'update-available' | 'update-downloaded',
    listener: (info: { version: string }) => void
  ): unknown
  on(event: 'download-progress', listener: (progress: { percent: number }) => void): unknown
  on(event: 'checking-for-update' | 'update-not-available' | 'error', listener: () => void): unknown
}

export interface UpdateService {
  info(): UpdateState
  check(): UpdateState
  install(): void
  setChannel(channel: UpdateChannel): UpdateState
  close(): void
}

export function channelFile(file: string): {
  read(): UpdateChannel | undefined
  save(channel: UpdateChannel): void
} {
  return {
    read() {
      try {
        const { channel } = JSON.parse(readFileSync(file, 'utf8')) as { channel?: unknown }
        if (channel === 'beta') return 'alpha'
        return channel === 'alpha' || channel === 'latest' ? channel : undefined
      } catch {
        return undefined
      }
    },
    save: (channel) => writeAtomicJson(file, { channel })
  }
}

export const defaultChannel = (version: string): UpdateChannel =>
  /-(alpha|beta)\./.test(version) ? 'alpha' : 'latest'

export const CHECK_EVERY_MS = 4 * 60 * 60 * 1000
export const FIRST_CHECK_MS = 30_000

type Options = {
  version: string
  updater: Updater | null
  channel?: UpdateChannel
  onChange: (state: UpdateState) => void
  onChannelChange?: (channel: UpdateChannel) => void
  now?: () => Date
  timers?: {
    setTimeout(fn: () => void, ms: number): unknown
    setInterval(fn: () => void, ms: number): unknown
    clear(handle: unknown): void
  }
}

const defaultTimers = {
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms).unref(),
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms).unref(),
  clear: (handle: unknown) => clearTimeout(handle as NodeJS.Timeout)
}

export function createUpdateService({
  version,
  updater,
  channel = defaultChannel(version),
  onChange,
  onChannelChange,
  now = () => new Date(),
  timers = defaultTimers
}: Options): UpdateService {
  let state: UpdateState = {
    version,
    channel,
    status: updater ? 'idle' : 'unavailable',
    next: null,
    progress: null,
    checkedAt: null,
    error: null
  }
  const set = (next: Partial<UpdateState>): void => {
    state = { ...state, ...next }
    onChange(state)
  }
  const handles: unknown[] = []

  function applyChannel(): void {
    if (!updater) return
    updater.channel = state.channel
    updater.allowPrerelease = state.channel === 'alpha'
    updater.allowDowngrade = state.channel === 'latest' && defaultChannel(version) === 'alpha'
  }

  if (updater) {
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    applyChannel()
    updater.on('checking-for-update', () => set({ status: 'checking', error: null }))
    updater.on('update-not-available', () =>
      set({ status: 'idle', next: null, progress: null, checkedAt: now().toISOString() })
    )
    updater.on('update-available', (info: { version: string }) =>
      set({
        status: 'downloading',
        next: info.version,
        progress: 0,
        checkedAt: now().toISOString()
      })
    )
    updater.on('download-progress', (progress: { percent: number }) =>
      set({ progress: Math.round(progress.percent) })
    )
    updater.on('update-downloaded', (info: { version: string }) =>
      set({ status: 'ready', next: info.version, progress: null })
    )
    updater.on('error', () => {
      if (state.status === 'ready') return
      set({
        status: 'error',
        progress: null,
        error: 'Não foi possível procurar a versão nova. Confira a internet e tente de novo.'
      })
    })
    handles.push(timers.setTimeout(() => check(), FIRST_CHECK_MS))
    handles.push(timers.setInterval(() => check(), CHECK_EVERY_MS))
  }

  function check(): UpdateState {
    if (!updater || ['checking', 'downloading', 'ready'].includes(state.status)) return state
    updater.checkForUpdates().catch(() => {})
    return state
  }

  return {
    info: () => state,
    check,
    install() {
      if (!updater || state.status !== 'ready') throw new Error('Nenhuma versão nova pronta.')
      updater.quitAndInstall(true, true)
    },
    setChannel(next) {
      if (next === state.channel) return state
      if (state.status === 'downloading' || state.status === 'ready') {
        throw new Error('Espere a versão nova terminar de baixar e ser instalada para trocar.')
      }
      set({ channel: next })
      onChannelChange?.(next)
      applyChannel()
      return check()
    },
    close() {
      for (const handle of handles) timers.clear(handle)
    }
  }
}
