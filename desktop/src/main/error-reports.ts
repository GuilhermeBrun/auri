import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import contract from '../../../web/contrato/relatorio-de-erro.json'
import type { ErrorReportsInfo } from '../shared/api'
import { writeAtomicJson } from './atomic-file'

export type ErrorOrigin = 'main' | 'renderer' | 'process'

export type CleanError = { name: string; message: string | null; stack: string | null }

export type ErrorReport = CleanError & {
  id: string
  at: string
  origin: ErrorOrigin
  count: number
  pending: boolean
}

export type ReportContext = {
  version: string
  channel: string
  platform: string
  arch: string
  osVersion: string
  electron: string
}

type Stored = { enabled: boolean; installId: string; reports: ErrorReport[] }

export const MAX_REPORTS = 50
export const BATCH = contract.reportsPerSend
export const SEND_DELAY_MS = 5_000
export const FIRST_SEND_MS = 30_000
export const RETRY_EVERY_MS = 60 * 60 * 1000
export const SAVE_DELAY_MS = 2_000

const FRAMES = 15

const { lengths } = contract

const SAFE_MESSAGES = new Set([
  'TypeError',
  'ReferenceError',
  'RangeError',
  'SqliteError',
  'DatabaseTooNewError'
])

const BUGS = new Set([
  'TypeError',
  'ReferenceError',
  'RangeError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'SqliteError'
])

const PROPERTY = /^[a-z_$][\w$]*$/

export function safeMessage(name: string, message: string | null | undefined): string | null {
  if (!message || !SAFE_MESSAGES.has(name)) return null
  return message
    .replace(/(["'`])(.*?)\1/g, (quoted, quote: string, inner: string) =>
      quote === "'" && PROPERTY.test(inner) ? quoted : `${quote}…${quote}`
    )
    .replace(/\d[\d./ -]*\d/g, (digits) => (digits.replace(/\D/g, '').length >= 4 ? '#' : digits))
    .slice(0, lengths.message)
}

export function isUnexpected(error: unknown): boolean {
  if (!(error instanceof Error)) return true
  if (BUGS.has(error.name)) return true
  const { code } = error as NodeJS.ErrnoException
  return typeof code === 'string' && /^E[A-Z]+$/.test(code)
}

export function cleanStack(stack: string | null | undefined, home: string): string | null {
  if (!stack) return null
  const lines = stack
    .split('\n')
    .filter((line) => /^\s*at /.test(line))
    .slice(0, FRAMES)
    .map((line) =>
      (home ? line.split(home).join('~') : line)
        .replace(/(?:file:\/\/)?[^\s(]*?app\.asar/g, 'app.asar')
        .replace(/\/(?:Users|home)\/[^/\s)]+/g, '~')
        .replace(/[A-Za-z]:\\Users\\[^\\\s)]+/gi, '~')
        .trim()
        .slice(0, 300)
    )
  return lines.length > 0 ? lines.join('\n').slice(0, lengths.stack) : null
}

export function cleanError(error: unknown, home: string): CleanError {
  const value = (typeof error === 'object' && error !== null ? error : {}) as Record<
    string,
    unknown
  >
  const name =
    typeof value.name === 'string' && value.name ? value.name.slice(0, lengths.name) : typeof error
  const message = typeof value.message === 'string' ? value.message : null
  const stack = typeof value.stack === 'string' ? value.stack : null
  return { name, message: safeMessage(name, message), stack: cleanStack(stack, home) }
}

const fitContext = (context: ReportContext): ReportContext => ({
  version: context.version.slice(0, lengths.version),
  channel: context.channel.slice(0, lengths.channel),
  platform: context.platform,
  arch: context.arch.slice(0, lengths.arch),
  osVersion: context.osVersion.slice(0, lengths.osVersion),
  electron: context.electron.slice(0, lengths.electron)
})

const signature = (origin: ErrorOrigin, error: CleanError): string =>
  `${origin}|${error.name}|${error.message ?? ''}|${error.stack?.split('\n')[0] ?? ''}`

type Timers = {
  setTimeout(fn: () => void, ms: number): unknown
  setInterval(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  setInterval: (fn, ms) => setInterval(fn, ms).unref(),
  clear: (handle) => clearTimeout(handle as NodeJS.Timeout)
}

export type ErrorReportService = {
  record(origin: ErrorOrigin, error: CleanError): void
  capture(origin: ErrorOrigin, error: unknown): void
  captureUnexpected(error: unknown): void
  info(): ErrorReportsInfo
  setEnabled(on: boolean): ErrorReportsInfo
  text(): string
  flush(): Promise<void>
  close(): void
}

export function createErrorReports(options: {
  file: string
  endpoint: string | null
  home: string
  context: () => ReportContext
  fetch?: typeof fetch
  timers?: Timers
  now?: () => Date
}): ErrorReportService {
  const { file, endpoint, home, context } = options
  const send = options.fetch ?? fetch
  const timers = options.timers ?? realTimers
  const now = options.now ?? (() => new Date())

  let state: Stored = { enabled: true, installId: randomUUID(), reports: [] }
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Partial<Stored>
    state = {
      enabled: saved.enabled !== false,
      installId: typeof saved.installId === 'string' ? saved.installId : state.installId,
      reports: Array.isArray(saved.reports) ? saved.reports.slice(-MAX_REPORTS) : []
    }
  } catch {}

  let sending = false
  let delayed: unknown = null
  let dueAt = Infinity
  let unsaved: unknown = null

  const save = (): void => {
    if (unsaved) timers.clear(unsaved)
    unsaved = null
    try {
      writeAtomicJson(file, state)
    } catch (error) {
      console.error(`[erros] não gravou: ${(error as Error).message}`)
    }
  }

  const saveSoon = (): void => {
    unsaved ??= timers.setTimeout(save, SAVE_DELAY_MS)
  }

  const cancel = (): void => {
    if (delayed) timers.clear(delayed)
    delayed = null
    dueAt = Infinity
  }

  const schedule = (ms: number): void => {
    if (!endpoint || !state.enabled) return
    const due = now().getTime() + ms
    if (delayed && dueAt <= due) return
    cancel()
    dueAt = due
    delayed = timers.setTimeout(() => {
      delayed = null
      dueAt = Infinity
      void service.flush()
    }, ms)
  }

  const interval = endpoint ? timers.setInterval(() => void service.flush(), RETRY_EVERY_MS) : null
  schedule(FIRST_SEND_MS)

  const service: ErrorReportService = {
    record(origin, raw) {
      const error = {
        name: raw.name.slice(0, lengths.name),
        message: raw.message?.slice(0, lengths.message) ?? null,
        stack: raw.stack?.slice(0, lengths.stack) ?? null
      }
      const key = signature(origin, error)
      const same = state.reports.findLast(
        (report) => (report.pending || !state.enabled) && signature(report.origin, report) === key
      )
      if (same) {
        same.count = Math.min(same.count + 1, contract.maxCount)
        saveSoon()
      } else {
        state.reports = [
          ...state.reports,
          {
            ...error,
            id: randomUUID(),
            at: now().toISOString(),
            origin,
            count: 1,
            pending: state.enabled
          }
        ].slice(-MAX_REPORTS)
        save()
      }
      schedule(SEND_DELAY_MS)
    },

    capture: (origin, error) => service.record(origin, cleanError(error, home)),

    captureUnexpected(error) {
      if (isUnexpected(error)) service.capture('main', error)
    },

    info: () => ({ enabled: state.enabled, count: state.reports.length }),

    setEnabled(on) {
      state.enabled = on
      if (!on) for (const report of state.reports) report.pending = false
      save()
      if (on) schedule(SEND_DELAY_MS)
      else cancel()
      return service.info()
    },

    text() {
      const { version, channel, platform, arch, osVersion } = context()
      const header = `Auri ${version} (${channel}) · ${platform} ${arch} ${osVersion}`
      const body = state.reports
        .toReversed()
        .map((report) =>
          [
            `${report.at} · ${report.origin} · ${report.name}${report.count > 1 ? ` (${report.count}x)` : ''}`,
            report.message,
            report.stack
          ]
            .filter(Boolean)
            .join('\n')
        )
      return [header, ...body].join('\n\n')
    },

    async flush() {
      if (!endpoint || !state.enabled || sending) return
      const pending = state.reports.filter((report) => report.pending).slice(0, BATCH)
      if (pending.length === 0) return
      const ctx = fitContext(context())
      const body = (reports: ErrorReport[]): string =>
        JSON.stringify({
          installId: state.installId,
          ...ctx,
          reports: reports.map(({ pending: _, ...report }) => report)
        })
      const batch: ErrorReport[] = []
      for (const report of pending) {
        if (Buffer.byteLength(body([...batch, report])) > contract.maxBytes) break
        batch.push(report)
      }
      if (batch.length === 0) {
        pending[0]!.pending = false
        save()
        return
      }
      const counts = new Map(batch.map((report) => [report.id, report.count]))
      sending = true
      try {
        const response = await send(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body(batch),
          redirect: 'error',
          signal: AbortSignal.timeout(15_000)
        })
        const done = response.ok || (response.status < 500 && response.status !== 429)
        if (!response.ok) console.error(`[erros] envio recusado: ${response.status}`)
        if (done) {
          const rest: ErrorReport[] = []
          for (const report of state.reports) {
            const sent = counts.get(report.id)
            if (sent === undefined) continue
            report.pending = false
            if (report.count <= sent) continue
            rest.push({
              ...report,
              id: randomUUID(),
              at: now().toISOString(),
              count: report.count - sent,
              pending: state.enabled
            })
            report.count = sent
          }
          state.reports = [...state.reports, ...rest].slice(-MAX_REPORTS)
          save()
          if (state.reports.some((report) => report.pending)) schedule(SEND_DELAY_MS)
        }
      } catch (error) {
        console.error(`[erros] envio falhou: ${(error as Error).message}`)
      } finally {
        sending = false
      }
    },

    close() {
      if (unsaved) save()
      cancel()
      if (interval) timers.clear(interval)
    }
  }
  return service
}
