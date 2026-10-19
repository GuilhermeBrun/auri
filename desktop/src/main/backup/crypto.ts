import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  type ScryptOptions
} from 'crypto'
import { z } from 'zod'

export const DEFAULT_KDF = { N: 2 ** 17, r: 8, p: 1 } as const
export type KdfParams = { N: number; r: number; p: number }

const b64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/)

export const envelopeSchema = z.object({
  salt: b64,
  N: z.number().int().positive(),
  r: z.number().int().positive(),
  p: z.number().int().positive(),
  iv: b64,
  key: b64,
  tag: b64
})
export type Envelope = z.infer<typeof envelopeSchema>

export class WrongSecretError extends Error {
  constructor(message = 'Senha incorreta.') {
    super(message)
    this.name = 'WrongSecretError'
  }
}

function scrypt(secret: string, salt: Buffer, params: KdfParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * params.N * params.r + 1024 * 1024
  }
  return new Promise((resolve, reject) =>
    scryptCallback(secret.normalize('NFC'), salt, 32, options, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  )
}

export function newKey(): Buffer {
  return randomBytes(32)
}

export function keyIdOf(key: Buffer): string {
  return createHash('sha256').update('auri:chave-da-copia:').update(key).digest('hex').slice(0, 16)
}

export async function seal(
  key: Buffer,
  secret: string,
  kdf: KdfParams = DEFAULT_KDF
): Promise<Envelope> {
  const salt = randomBytes(16)
  const kek = await scrypt(secret, salt, kdf)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', kek, iv)
  const sealed = Buffer.concat([cipher.update(key), cipher.final()])
  return {
    salt: salt.toString('base64'),
    ...kdf,
    iv: iv.toString('base64'),
    key: sealed.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  }
}

export async function unseal(envelope: Envelope, secret: string, wrong?: string): Promise<Buffer> {
  const kek = await scrypt(secret, Buffer.from(envelope.salt, 'base64'), envelope)
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  try {
    return Buffer.concat([decipher.update(Buffer.from(envelope.key, 'base64')), decipher.final()])
  } catch {
    throw new WrongSecretError(wrong)
  }
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('')
const RECOVERY_LENGTH = 24

export function newRecoveryCode(): string {
  const chars = Array.from(
    { length: RECOVERY_LENGTH },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]
  )
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-')
}

export function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function newIv(): Buffer {
  return randomBytes(12)
}

export function encrypt(
  key: Buffer,
  iv: Buffer,
  data: Buffer,
  aad: Buffer
): { data: Buffer; tag: Buffer } {
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const out = Buffer.concat([cipher.update(data), cipher.final()])
  return { data: out, tag: cipher.getAuthTag() }
}

export class BackupFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFileError'
  }
}

export function decrypt(key: Buffer, iv: Buffer, data: Buffer, tag: Buffer, aad: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(data), decipher.final()])
  } catch {
    throw new BackupFileError('Este arquivo de cópia está danificado ou foi alterado.')
  }
}
