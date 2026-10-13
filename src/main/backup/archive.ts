import { open } from 'fs/promises'
import { gunzipSync, gzipSync } from 'zlib'
import { z } from 'zod'
import {
  BackupFileError,
  decrypt,
  DEFAULT_KDF,
  encrypt,
  envelopeSchema,
  keyIdOf,
  newIv,
  newKey,
  normalizeRecoveryCode,
  seal,
  unseal,
  type KdfParams,
  WrongSecretError
} from './crypto'

/**
 * Arquivo `.auribackup` (ver docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md):
 * "AURIBAK1" | tamanho do cabeçalho (uint32) | cabeçalho JSON | dados cifrados | etiqueta GCM.
 * O cabeçalho é legível sem senha (data e contagens para a lista) e vai como dado adicional do
 * GCM, então qualquer mudança nele invalida o arquivo.
 */
const MAGIC = Buffer.from('AURIBAK1')
const PREFIX = MAGIC.length + 4
const TAG_LENGTH = 16
/** Cabeçalho de verdade tem ~1 KB; isso barra arquivos estranhos antes de ler megabytes. */
const MAX_HEADER = 64 * 1024

export const BACKUP_EXTENSION = '.auribackup'

export const headerSchema = z.object({
  format: z.literal(1),
  createdAt: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  counts: z.object({
    patients: z.number().int().nonnegative(),
    appointments: z.number().int().nonnegative()
  }),
  keyId: z.string().regex(/^[0-9a-f]{16}$/),
  iv: z.string(),
  keys: z.object({ password: envelopeSchema, recovery: envelopeSchema })
})
export type BackupHeader = z.infer<typeof headerSchema>

/** Chave da cópia e os dois envelopes dela: o que basta para gravar sem pedir a senha. */
export type Keyring = {
  key: Buffer
  keyId: string
  password: BackupHeader['keys']['password']
  recovery: BackupHeader['keys']['recovery']
}

/**
 * Chave nova presa à senha e ao código de recuperação. `key` permite manter a mesma chave (só
 * para testes e para adotar a chave de uma cópia restaurada); o normal é sortear uma nova.
 */
export async function createKeyring(
  password: string,
  recoveryCode: string,
  kdf: KdfParams = DEFAULT_KDF,
  key: Buffer = newKey()
): Promise<Keyring> {
  const [sealedPassword, sealedRecovery] = await Promise.all([
    seal(key, password, kdf),
    seal(key, normalizeRecoveryCode(recoveryCode), kdf)
  ])
  return { key, keyId: keyIdOf(key), password: sealedPassword, recovery: sealedRecovery }
}

/** Como abrir uma cópia de outro computador. */
export type Secret = { password: string } | { recoveryCode: string }

const notBackup = (): BackupFileError =>
  new BackupFileError('Este arquivo não é uma cópia de segurança do Auri.')

/** Monta o arquivo: os dados vão comprimidos e cifrados com a chave do `keyring`. */
export function packBackup(
  keyring: Keyring,
  meta: Pick<BackupHeader, 'createdAt' | 'schemaVersion' | 'counts'>,
  database: Buffer
): Buffer {
  // o iv entra no cabeçalho antes de cifrar, para o cabeçalho inteiro ser o dado adicional
  const iv = newIv()
  const header: BackupHeader = {
    format: 1,
    ...meta,
    keyId: keyring.keyId,
    iv: iv.toString('base64'),
    keys: { password: keyring.password, recovery: keyring.recovery }
  }
  const headerBytes = Buffer.from(JSON.stringify(header))
  const sealed = encrypt(keyring.key, iv, gzipSync(database), headerBytes)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(headerBytes.length)
  return Buffer.concat([MAGIC, size, headerBytes, sealed.data, sealed.tag])
}

function parseHeader(bytes: Buffer): BackupHeader {
  try {
    return headerSchema.parse(JSON.parse(bytes.toString('utf8')))
  } catch {
    throw notBackup()
  }
}

function headerLength(prefix: Buffer): number {
  if (prefix.length < PREFIX || !prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw notBackup()
  const length = prefix.readUInt32BE(MAGIC.length)
  if (length === 0 || length > MAX_HEADER) throw notBackup()
  return length
}

/** Só o cabeçalho, lendo o começo do arquivo (para listar cópias sem abrir os dados). */
export async function readHeaderFromFile(file: string): Promise<BackupHeader> {
  const handle = await open(file, 'r')
  try {
    const prefix = Buffer.alloc(PREFIX)
    await handle.read(prefix, 0, PREFIX, 0)
    const length = headerLength(prefix)
    const bytes = Buffer.alloc(length)
    const { bytesRead } = await handle.read(bytes, 0, length, PREFIX)
    if (bytesRead < length) throw notBackup()
    return parseHeader(bytes)
  } finally {
    await handle.close()
  }
}

export function readHeader(file: Buffer): BackupHeader {
  const length = headerLength(file)
  return parseHeader(file.subarray(PREFIX, PREFIX + length))
}

/** Decifra e descomprime: devolve o arquivo SQLite. Arquivo alterado: `BackupFileError`. */
export function unpackBackup(
  file: Buffer,
  key: Buffer
): { header: BackupHeader; database: Buffer } {
  const length = headerLength(file)
  const headerBytes = file.subarray(PREFIX, PREFIX + length)
  const header = parseHeader(headerBytes)
  const body = file.subarray(PREFIX + length)
  if (body.length < TAG_LENGTH) throw notBackup()
  const plain = decrypt(
    key,
    Buffer.from(header.iv, 'base64'),
    body.subarray(0, body.length - TAG_LENGTH),
    body.subarray(body.length - TAG_LENGTH),
    headerBytes
  )
  try {
    return { header, database: gunzipSync(plain) }
  } catch {
    throw new BackupFileError('Este arquivo de cópia está danificado ou foi alterado.')
  }
}

/** A chave de uma cópia a partir da senha ou do código de recuperação. */
export async function keyFromSecret(header: BackupHeader, secret: Secret): Promise<Buffer> {
  if ('password' in secret) return unseal(header.keys.password, secret.password)
  try {
    return await unseal(header.keys.recovery, normalizeRecoveryCode(secret.recoveryCode))
  } catch (error) {
    if (error instanceof WrongSecretError)
      throw new WrongSecretError('Código de recuperação incorreto.')
    throw error
  }
}
