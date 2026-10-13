import { z } from 'zod'
import { DATA_TOPICS } from '../../shared/api'

/**
 * Versão do protocolo entre dois Auri. Mude ao alterar o formato das mensagens ou o significado de
 * uma operação; versões diferentes (do protocolo ou do banco) não conversam.
 */
export const PROTOCOL_VERSION = 1

/** Porta preferida na rede local; se estiver ocupada, o sistema escolhe outra (o anúncio leva a certa). */
export const DEFAULT_PORT = 47390

/** Pedidos do cliente são pequenos: acima disso a conexão cai. */
export const MAX_REQUEST_BYTES = 1024 * 1024

const hex = z
  .string()
  .regex(/^[0-9a-f]+$/)
  .max(256)
const name = z.string().trim().min(1).max(60)

export const clientMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    protocol: z.number().int(),
    schema: z.number().int(),
    name,
    /** Só no pareamento: `pairingProof(código, 'client', handshakeHash)` em hex. */
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
export type RejectReason = (typeof REJECT_REASONS)[number]

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
  z.object({ t: z.literal('event'), topics: z.array(z.enum(DATA_TOPICS)) }),
  z.object({ t: z.literal('pong') })
])

export type ServerMessage = z.infer<typeof serverMessage>

export function encode(message: ClientMessage | ServerMessage): Buffer {
  return Buffer.from(JSON.stringify(message))
}

/** Mensagem malformada vira null: quem recebe derruba a conexão. */
export function decode<T>(schema: z.ZodType<T>, data: Buffer): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(data.toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
