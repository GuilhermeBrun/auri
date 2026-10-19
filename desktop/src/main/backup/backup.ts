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

export const KEEP_BACKUPS = 30

export function backupFolder(root: string): string {
  return join(root, 'Auri', 'Cópias')
}

const pad = (n: number): string => String(n).padStart(2, '0')

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

async function writeAtomic(file: string, data: Buffer): Promise<void> {
  await writeFile(`${file}.tmp`, data)
  await rename(`${file}.tmp`, file)
}

async function freeName(folder: string, name: string, keyId: string): Promise<string> {
  const stem = name.slice(0, -BACKUP_EXTENSION.length)
  for (let n = 1; ; n++) {
    const file = join(folder, n === 1 ? name : `${stem} (${n})${BACKUP_EXTENSION}`)
    if (!existsSync(file)) return file
    const existing = await describeBackup(file)
    if (existing?.keyId === keyId) return file
  }
}

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
