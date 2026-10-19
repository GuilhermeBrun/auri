import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const CODE_LENGTH = 12
export const CODE_TTL_MS = 5 * 60_000
export const MAX_ATTEMPTS = 5

export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

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
