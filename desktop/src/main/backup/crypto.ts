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

/**
 * Custo do scrypt que transforma a senha (ou o código de recuperação) em chave: ~128 MB e uns
 * 300 ms por tentativa, o que torna adivinhar a senha de um arquivo roubado caro. Os parâmetros
 * vão no arquivo, então dá para subir no futuro sem perder as cópias antigas.
 */
export const DEFAULT_KDF = { N: 2 ** 17, r: 8, p: 1 } as const
export type KdfParams = { N: number; r: number; p: number }

const b64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/)

/** A chave da cópia cifrada por uma senha ou pelo código de recuperação. */
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

/** Senha ou código de recuperação que não abrem o envelope. */
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
    // o padrão do Node (32 MB) não comporta o custo acima
    maxmem: 256 * params.N * params.r + 1024 * 1024
  }
  return new Promise((resolve, reject) =>
    scryptCallback(secret.normalize('NFC'), salt, 32, options, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  )
}

/** Chave nova para as cópias (AES-256). */
export function newKey(): Buffer {
  return randomBytes(32)
}

/** Identifica a chave sem revelá-la: duas cópias com o mesmo id abrem com a mesma chave. */
export function keyIdOf(key: Buffer): string {
  return createHash('sha256').update('auri:chave-da-copia:').update(key).digest('hex').slice(0, 16)
}

/** Cifra a chave da cópia com a senha (ou o código de recuperação). */
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

/** Abre o envelope. Senha errada: `WrongSecretError` (a etiqueta do GCM não confere). */
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

/**
 * Letras e números sem os que se confundem no papel (0/O, 1/I). 32 símbolos = 5 bits cada; 24
 * símbolos dão 120 bits, longe de qualquer adivinhação.
 */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('')
const RECOVERY_LENGTH = 24

/** Código de recuperação novo, em grupos de 4: "K7QM-2XRT-…". */
export function newRecoveryCode(): string {
  const chars = Array.from(
    { length: RECOVERY_LENGTH },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]
  )
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-')
}

/** Como o usuário digitou → como o código é usado: sem espaços nem traços, em maiúsculas. */
export function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Vetor de inicialização novo para o AES-GCM (nunca repetir com a mesma chave). */
export function newIv(): Buffer {
  return randomBytes(12)
}

/** Cifra os dados com a chave da cópia; `aad` (o cabeçalho) fica amarrado a eles. */
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

/** Erro de leitura de uma cópia, com mensagem pronta para a tela. */
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
