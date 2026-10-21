import { z } from 'zod'
import { AGENDA_CHANGES } from '../../shared/agenda-notice'
import { DATA_TOPICS } from '../../shared/api'

export const PROTOCOL_VERSION = 1

export const DEFAULT_PORT = 47390

export const MAX_REQUEST_BYTES = 1024 * 1024

const hex = z
  .string()
  .regex(/^[0-9a-f]+$/)
  .max(256)
const name = z.string().trim().min(1).max(60)

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  .max(30)

const agendaNoticeSchema = z.object({
  change: z.enum(AGENDA_CHANGES),
  kind: z.enum(['sessao', 'compromisso']),
  nome: z.string().max(160),
  inicio: localDateTime,
  antes: localDateTime.optional(),
  autor: name
})

export const clientMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    protocol: z.number().int(),
    schema: z.number().int(),
    name,
    proof: hex.optional()
  }),
  z.object({
    t: z.literal('req'),
    id: z.number().int().nonnegative(),
    channel: z.string().max(60),
    args: z.array(z.unknown()).max(5)
  }),
  z.object({ t: z.literal('ping') })
])

export type ClientMessage = z.infer<typeof clientMessage>

export const REJECT_REASONS = [
  'version',
  'unpaired',
  'code-none',
  'code-expired',
  'code-wrong'
] as const

export const serverMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('welcome'), name, proof: hex.optional() }),
  z.object({ t: z.literal('reject'), reason: z.enum(REJECT_REASONS) }),
  z.object({
    t: z.literal('res'),
    id: z.number().int().nonnegative(),
    result: z.union([
      z.object({ ok: z.literal(true), data: z.unknown() }),
      z.object({ ok: z.literal(false), error: z.string() })
    ])
  }),
  z.object({
    t: z.literal('event'),
    topics: z.array(z.enum(DATA_TOPICS)),
    notice: agendaNoticeSchema.optional()
  }),
  z.object({ t: z.literal('pong') })
])

export type ServerMessage = z.infer<typeof serverMessage>

export function encode(message: ClientMessage | ServerMessage): Buffer {
  return Buffer.from(JSON.stringify(message))
}

export function decode<T>(schema: z.ZodType<T>, data: Buffer): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(data.toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
