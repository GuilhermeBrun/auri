import { readFileSync } from 'node:fs'
import type { UpdateChannel, UpdateState } from '../shared/api'
import { writeAtomicJson } from './atomic-file'

/**
 * Saída de `codesign -dv` (vem no stderr) de um app assinado com um Developer ID: só ele tem Team
 * ID. Na assinatura ad-hoc vem `TeamIdentifier=not set`, e o macOS não aceita trocar o app.
 */
export function hasTeamIdentifier(codesignOutput: string): boolean {
  return /^TeamIdentifier=(?!not set$)\S+$/m.test(codesignOutput)
}

/** O que o serviço usa do `autoUpdater` do electron-updater (os testes passam um falso). */
export interface Updater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  /** Arquivo procurado no site de atualização: `latest.yml` ou `beta.yml`. */
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

/**
 * O canal escolhido fica em `atualizacoes.json`, ao lado das preferências. Sem arquivo (ou
 * inválido), vale o da versão instalada.
 */
export function channelFile(file: string): {
  read(): UpdateChannel | undefined
  save(channel: UpdateChannel): void
} {
  return {
    read() {
      try {
        const { channel } = JSON.parse(readFileSync(file, 'utf8')) as { channel?: unknown }
        return channel === 'beta' || channel === 'latest' ? channel : undefined
      } catch {
        return undefined
      }
    },
    save: (channel) => writeAtomicJson(file, { channel })
  }
}

/** Uma versão beta instalada (`1.2.3-beta.20261016.1`) começa no canal beta. */
export const defaultChannel = (version: string): UpdateChannel =>
  version.includes('-beta.') ? 'beta' : 'latest'

/** Procura de novo a cada 4 horas: a clínica deixa o Auri aberto o dia todo. */
export const CHECK_EVERY_MS = 4 * 60 * 60 * 1000
/** Primeira procura um pouco depois de abrir, para não disputar com a abertura da janela. */
export const FIRST_CHECK_MS = 30_000

type Options = {
  version: string
  /** null: este computador não se atualiza sozinho (ver `UpdateStatus`). */
  updater: Updater | null
  /** O canal escolhido antes; sem escolha, o da versão instalada. */
  channel?: UpdateChannel
  onChange: (state: UpdateState) => void
  /** Grava a escolha do canal (o main guarda num arquivo ao lado das preferências). */
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

/**
 * Atualização automática: procura, baixa sozinha e instala ao sair (ou na hora,
 * em Configurações › Geral). Os dados ficam na pasta do usuário, fora da instalação.
 */
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

  // No beta também valem as prereleases. Voltando para a estável com um beta instalado, a estável
  // pode ser "mais velha" que ele (1.2.0 < 1.2.1-beta): aceita descer para não ficar preso no beta.
  function applyChannel(): void {
    if (!updater) return
    updater.channel = state.channel
    updater.allowPrerelease = state.channel === 'beta'
    updater.allowDowngrade = state.channel === 'latest' && defaultChannel(version) === 'beta'
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
      // uma procura que falha depois do download não desfaz a versão pronta
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
    // a falha também chega pelo evento 'error', que mostra a mensagem
    updater.checkForUpdates().catch(() => {})
    return state
  }

  return {
    info: () => state,
    check,
    install() {
      if (!updater || state.status !== 'ready') throw new Error('Nenhuma versão nova pronta.')
      // silencioso (sem as telas do instalador) e abrindo o Auri de novo no fim
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
