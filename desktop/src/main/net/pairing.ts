import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { DeviceGrant } from '../../shared/api'

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
  | { ok: true; code: string; grant: DeviceGrant }
  | { ok: false; reason: 'none' | 'expired' | 'wrong' }
  | { ok: false; reason: 'refused'; grant: DeviceGrant }

export type PairingCodes = {
  issue(grant: DeviceGrant): { code: string; expiresAt: number }
  cancel(): void
  active(): DeviceGrant | null
  check(
    proof: Buffer,
    handshakeHash: Buffer,
    accepts?: (grant: DeviceGrant) => boolean
  ): PairingCheck
}

export function createPairingCodes(now: () => number = Date.now): PairingCodes {
  let current: { code: string; expiresAt: number; attempts: number; grant: DeviceGrant } | null =
    null
  return {
    issue(grant) {
      current = { code: generateCode(), expiresAt: now() + CODE_TTL_MS, attempts: 0, grant }
      return { code: current.code, expiresAt: current.expiresAt }
    },
    cancel() {
      current = null
    },
    active() {
      return current && now() <= current.expiresAt ? current.grant : null
    },
    check(proof, handshakeHash, accepts = () => true) {
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
      if (!accepts(current.grant)) return { ok: false, reason: 'refused', grant: current.grant }
      const { code, grant } = current
      current = null
      return { ok: true, code, grant }
    }
  }
}
