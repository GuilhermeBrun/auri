import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import type { Db } from '../db/connection'
import { SCHEMA_VERSION } from '../db/migrations'
import {
  BACKUP_EXTENSION,
  packBackup,
  readHeaderFromFile,
  unpackBackup,
  type BackupHeader,
  type Keyring
} from './archive'
import { BackupFileError } from './crypto'

/** Quantas cópias ficam na pasta; as mais antigas saem a cada cópia nova. */
export const KEEP_BACKUPS = 30

/** Onde as cópias ficam dentro da pasta escolhida (a raiz do Drive, por exemplo). */
export function backupFolder(root: string): string {
  return join(root, 'Auri', 'Cópias')
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** "Auri 2026-10-13 19h00.auribackup": ordena por data e se lê bem na pasta da nuvem. */
export function backupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `Auri ${day} ${pad(date.getHours())}h${pad(date.getMinutes())}${BACKUP_EXTENSION}`
}

export type BackupEntry = {
  file: string
  name: string
  createdAt: string
  schemaVersion: number
  counts: BackupHeader['counts']
  keyId: string
  size: number
}

/** Grava num temporário ao lado e renomeia: quem sincroniza nunca vê o arquivo pela metade. */
async function writeAtomic(file: string, data: Buffer): Promise<void> {
  await writeFile(`${file}.tmp`, data)
  await rename(`${file}.tmp`, file)
}

/**
 * Caminho para a cópia nova. Uma cópia deste mesmo computador no mesmo minuto é trocada pela nova;
 * a de outro computador (outra chave) na mesma pasta nunca: a nova ganha " (2)" no nome.
 */
async function freeName(folder: string, name: string, keyId: string): Promise<string> {
  const stem = name.slice(0, -BACKUP_EXTENSION.length)
  for (let n = 1; ; n++) {
    const file = join(folder, n === 1 ? name : `${stem} (${n})${BACKUP_EXTENSION}`)
    if (!existsSync(file)) return file
    const existing = await describeBackup(file)
    if (existing?.keyId === keyId) return file
  }
}

/** Contagens e versão de um arquivo SQLite (aberto só para leitura). */
function describeDatabase(file: string): Pick<BackupHeader, 'schemaVersion' | 'counts'> {
  const db = new Database(file, { readonly: true, fileMustExist: true })
  try {
    const count = (table: string): number =>
      (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
    return {
      schemaVersion: db.pragma('user_version', { simple: true }) as number,
      counts: { patients: count('patients'), appointments: count('appointments') }
    }
  } finally {
    db.close()
  }
}

/**
 * Faz uma cópia do banco em uso (a API de backup do SQLite copia um retrato consistente mesmo com
 * gravações no meio), cifra e grava na pasta. Depois apaga as que passaram de `KEEP_BACKUPS`.
 */
export async function createBackup(options: {
  db: Db
  folder: string
  keyring: Keyring
  tmpDir: string
  now?: Date
}): Promise<BackupEntry> {
  const now = options.now ?? new Date()
  await mkdir(options.folder, { recursive: true })
  await mkdir(options.tmpDir, { recursive: true })
  const snapshot = join(options.tmpDir, `retrato-${now.getTime()}.db`)
  try {
    await options.db.backup(snapshot)
    const meta = { createdAt: now.toISOString(), ...describeDatabase(snapshot) }
    const packed = packBackup(options.keyring, meta, await readFile(snapshot))
    const file = await freeName(options.folder, backupFileName(now), options.keyring.keyId)
    await writeAtomic(file, packed)
    await pruneBackups(options.folder, KEEP_BACKUPS)
    return {
      file,
      name: basename(file),
      ...meta,
      keyId: options.keyring.keyId,
      size: packed.length
    }
  } finally {
    await rm(snapshot, { force: true })
  }
}

/** Uma cópia pelo cabeçalho; null se o arquivo não for uma cópia válida. */
export async function describeBackup(file: string): Promise<BackupEntry | null> {
  try {
    const [header, info] = await Promise.all([readHeaderFromFile(file), stat(file)])
    return {
      file,
      name: basename(file),
      createdAt: header.createdAt,
      schemaVersion: header.schemaVersion,
      counts: header.counts,
      keyId: header.keyId,
      size: info.size
    }
  } catch {
    return null
  }
}

/** Cópias da pasta, da mais nova para a mais antiga. Pasta que não existe: nenhuma. */
export async function listBackups(folder: string): Promise<BackupEntry[]> {
  let names: string[]
  try {
    names = await readdir(folder)
  } catch {
    return []
  }
  const entries = await Promise.all(
    names
      .filter((name) => name.endsWith(BACKUP_EXTENSION))
      .map((name) => describeBackup(join(folder, name)))
  )
  return entries
    .filter((entry): entry is BackupEntry => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function pruneBackups(folder: string, keep: number): Promise<void> {
  const entries = await listBackups(folder)
  await Promise.all(entries.slice(keep).map((entry) => rm(entry.file, { force: true })))
}

/** Confere o banco de uma cópia antes de ele tomar o lugar do atual. */
function validateDatabase(file: string): void {
  let db: Database.Database
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
  } catch {
    throw new BackupFileError('Esta cópia está danificada.')
  }
  try {
    const version = db.pragma('user_version', { simple: true }) as number
    if (version > SCHEMA_VERSION) {
      throw new BackupFileError(
        'Esta cópia foi feita numa versão mais nova do Auri. Atualize o Auri e tente de novo.'
      )
    }
    const ok = db.pragma('integrity_check', { simple: true })
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all()
      .map((row) => (row as { name: string }).name)
    if (ok !== 'ok' || !tables.includes('patients') || !tables.includes('appointments')) {
      throw new BackupFileError('Esta cópia está danificada.')
    }
  } catch (error) {
    if (error instanceof BackupFileError) throw error
    throw new BackupFileError('Esta cópia está danificada.')
  } finally {
    db.close()
  }
}

/**
 * Decifra uma cópia num arquivo SQLite temporário e confere se ele está inteiro e é de uma versão
 * que este Auri sabe abrir. Quem chama troca o banco por ele (`Connection.replaceDatabase`).
 */
export async function extractBackup(file: string, key: Buffer, out: string): Promise<BackupHeader> {
  const { header, database } = unpackBackup(await readFile(file), key)
  await writeFile(out, database)
  try {
    validateDatabase(out)
  } catch (error) {
    await rm(out, { force: true })
    throw error
  }
  return header
}

/**
 * Cifra de novo, com o `next`, as cópias da pasta feitas com a chave `previous` (troca de senha
 * ou de código). As de outra chave ficam como estão. Devolve quantas mudaram.
 */
export async function reencryptBackups(
  folder: string,
  previous: Pick<Keyring, 'key' | 'keyId'>,
  next: Keyring
): Promise<number> {
  const entries = (await listBackups(folder)).filter((entry) => entry.keyId === previous.keyId)
  for (const entry of entries) {
    const { header, database } = unpackBackup(await readFile(entry.file), previous.key)
    const meta = {
      createdAt: header.createdAt,
      schemaVersion: header.schemaVersion,
      counts: header.counts
    }
    await writeAtomic(entry.file, packBackup(next, meta, database))
  }
  return entries.length
}
