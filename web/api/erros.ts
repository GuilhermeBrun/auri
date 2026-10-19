import postgres from 'postgres'
import { z } from 'zod'
import contract from '../contrato/relatorio-de-erro.json' with { type: 'json' }

const { lengths } = contract

const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replaceAll('\u0000', ''))

const oneOf = (values: string[]) => z.enum(values as [string, ...string[]])

const reportSchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  origin: oneOf(contract.origins),
  name: text(lengths.name),
  message: text(lengths.message).nullable(),
  stack: text(lengths.stack).nullable(),
  count: z.int().min(1).max(contract.maxCount)
})

export const payloadSchema = z.object({
  installId: z.uuid(),
  version: text(lengths.version),
  channel: text(lengths.channel),
  platform: oneOf(contract.platforms),
  arch: text(lengths.arch),
  osVersion: text(lengths.osVersion),
  electron: text(lengths.electron),
  reports: z.array(reportSchema).min(1).max(contract.reportsPerSend)
})

export type Payload = z.infer<typeof payloadSchema>

export type SaveReports = (payload: Payload, receivedAt: Date) => Promise<unknown>

export type Env = Record<string, unknown>

export class Rejected extends Error {}

const status = (code: number): Response => new Response(null, { status: code })

function setting(name: string, env?: Env): string | undefined {
  const node = (globalThis as { process?: { env: Env } }).process?.env
  const value = env?.[name] ?? node?.[name]
  return typeof value === 'string' && value ? value : undefined
}

async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > contract.maxBytes) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let raw = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return raw + decoder.decode()
    size += value.byteLength
    if (size > contract.maxBytes) {
      await reader.cancel()
      return null
    }
    raw += decoder.decode(value, { stream: true })
  }
}

export async function receive(
  request: Request,
  save: SaveReports,
  now = new Date()
): Promise<Response> {
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  const raw = await readBody(request)
  if (raw === null) return status(413)
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return status(400)
  }
  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) return status(400)
  try {
    await save(parsed.data, now)
  } catch (error) {
    console.error(`[erros] não gravou: ${(error as Error).message}`)
    return status(error instanceof Rejected ? 400 : 503)
  }
  return status(204)
}

export function connect(url: string, options: postgres.Options<{}> = {}, env?: Env): postgres.Sql {
  const target = new URL(url)
  target.searchParams.delete('channel_binding')
  return postgres(target.toString(), {
    ...options,
    ssl: setting('DATABASE_SSL', env) === 'disable' ? false : 'verify-full'
  })
}

export function saveTo(sql: postgres.Sql): SaveReports {
  return async (payload, receivedAt) => {
    const rows = payload.reports.map((report) => ({
      id: report.id,
      install_id: payload.installId,
      happened_at: report.at,
      received_at: receivedAt,
      origin: report.origin,
      name: report.name,
      message: report.message,
      stack: report.stack,
      count: report.count,
      version: payload.version,
      channel: payload.channel,
      platform: payload.platform,
      arch: payload.arch,
      os_version: payload.osVersion,
      electron: payload.electron
    }))
    try {
      await sql`INSERT INTO error_reports ${sql(rows)} ON CONFLICT DO NOTHING`
    } catch (error) {
      const { code } = error as { code?: unknown }
      if (typeof code === 'string' && /^2[23]/.test(code))
        throw new Rejected((error as Error).message, { cause: error })
      throw error
    }
  }
}

let save: SaveReports | null = null

export default {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = setting('DATABASE_URL', env)
    if (!url) return status(503)
    try {
      save ??= saveTo(
        connect(
          url,
          { max: Number(setting('DATABASE_POOL', env) ?? 1), idle_timeout: 20, prepare: false },
          env
        )
      )
    } catch (error) {
      console.error(`[erros] não conectou: ${(error as Error).message}`)
      return status(503)
    }
    return receive(request, save)
  }
}
