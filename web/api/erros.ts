import postgres from 'postgres'
import { z } from 'zod'
import contract from '../contrato/relatorio-de-erro.json' with { type: 'json' }

const { lengths } = contract

const text = (max: number) => z.string().max(max)

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

const status = (code: number): Response => new Response(null, { status: code })

export async function receive(
  request: Request,
  save: SaveReports,
  now = new Date()
): Promise<Response> {
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  if (Number(request.headers.get('content-length') ?? 0) > contract.maxBytes) return status(413)
  const raw = await request.text()
  if (Buffer.byteLength(raw) > contract.maxBytes) return status(413)
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
    return status(503)
  }
  return status(204)
}

export function connect(url: string, options: postgres.Options<{}> = {}): postgres.Sql {
  return postgres(url, {
    ...options,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'verify-full'
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
    await sql`INSERT INTO error_reports ${sql(rows)} ON CONFLICT DO NOTHING`
  }
}

let save: SaveReports | null = null

export default {
  async fetch(request: Request): Promise<Response> {
    const url = process.env.DATABASE_URL
    if (!url) return status(503)
    save ??= saveTo(
      connect(url, {
        max: Number(process.env.DATABASE_POOL ?? 1),
        idle_timeout: 20,
        prepare: false
      })
    )
    return receive(request, save)
  }
}
