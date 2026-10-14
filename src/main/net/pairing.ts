import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Base32 de Crockford: sem I, L, O e U, que se confundem com 1, 0 e V ao ler e digitar. Ao digitar,
 * `normalizeCode` aceita minúsculas, espaços, hífens e as letras confundíveis.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * 12 caracteres = 60 bits. Quem interceptar uma tentativa de pareamento pode testar códigos à
 * vontade contra a prova (fora da rede, sem limite de tentativas); com 6 dígitos isso levaria
 * milissegundos, com 60 bits é inviável nos 5 minutos de validade.
 */
export const CODE_LENGTH = 12
export const CODE_TTL_MS = 5 * 60_000
export const MAX_ATTEMPTS = 5

export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

/** "K7Q29XMP3HTA" → "K7Q2 9XMP 3HTA", para ler em voz alta e conferir. */
export function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ')
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V')
}

/**
 * Prova de que um lado conhece o código, amarrada a esta conexão: o hash do handshake é o mesmo dos
 * dois lados e depende das duas chaves. Um intermediário fala com cada lado usando chaves dele,
 * então os hashes diferem e a prova não confere. O código nunca viaja.
 */
export function pairingProof(
  code: string,
  side: 'client' | 'server',
  handshakeHash: Buffer
): Buffer {
  return createHmac('sha256', normalizeCode(code))
    .update(`auri-pareamento-${side}:`)
    .update(handshakeHash)
    .digest()
}

export function proofMatches(expected: Buffer, received: Buffer): boolean {
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export type PairingCheck =
  | { ok: true; code: string }
  | { ok: false; reason: 'none' | 'expired' | 'wrong' }

/**
 * O código de pareamento em uso no servidor: um por vez, vale `CODE_TTL_MS`, uma vez só, e é
 * descartado depois de `MAX_ATTEMPTS` provas erradas.
 */
export function createPairingCodes(now: () => number = Date.now): {
  issue(): { code: string; expiresAt: number }
  cancel(): void
  check(proof: Buffer, handshakeHash: Buffer): PairingCheck
} {
  let current: { code: string; expiresAt: number; attempts: number } | null = null
  return {
    issue() {
      current = { code: generateCode(), expiresAt: now() + CODE_TTL_MS, attempts: 0 }
      return { code: current.code, expiresAt: current.expiresAt }
    },
    cancel() {
      current = null
    },
    check(proof, handshakeHash) {
      if (!current) return { ok: false, reason: 'none' }
      if (now() > current.expiresAt) {
        current = null
        return { ok: false, reason: 'expired' }
      }
      if (!proofMatches(pairingProof(current.code, 'client', handshakeHash), proof)) {
        current.attempts++
        if (current.attempts >= MAX_ATTEMPTS) current = null
        return { ok: false, reason: 'wrong' }
      }
      const { code } = current
      current = null
      return { ok: true, code }
    }
  }
}
