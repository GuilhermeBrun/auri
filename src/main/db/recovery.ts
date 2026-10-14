import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { copyFileSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { openDatabase, type Db } from './connection'
import { SCHEMA_VERSION } from './migrations'
import { PATIENT_FIELDS } from '../../shared/schemas'

/** Validação anterior à migração: uma base vazia não pode tomar o lugar dos dados. */
function inspect(file: string): void {
  const candidate = new Database(file, { readonly: true, fileMustExist: true })
  try {
    const version = candidate.pragma('user_version', { simple: true }) as number
    if (version < 1 || version > SCHEMA_VERSION)
      throw new Error('Versão do banco incompatível com esta versão do Auri.')
    if (candidate.pragma('integrity_check', { simple: true }) !== 'ok')
      throw new Error('O banco de recuperação está danificado.')
    // Verifica também o contrato das tabelas, e não somente a integridade do arquivo SQLite.
    candidate.prepare('SELECT id FROM patients LIMIT 0').all()
    candidate.prepare('SELECT id, patient_id FROM appointments LIMIT 0').all()
    if ((candidate.pragma('foreign_key_check') as unknown[]).length !== 0)
      throw new Error('O banco de recuperação contém referências inválidas.')
  } finally {
    candidate.close()
  }
}

/**
 * Prepara e migra uma cópia no mesmo volume antes de fechar o banco atual. A troca é por rename;
 * falha ao promover ou abrir a cópia repõe o arquivo anterior. O chamador reabre o banco após erro.
 */
export function restoreDatabase(current: Db, file: string, source: string): Db {
  if (resolve(source) === resolve(file)) throw new Error('Escolha outro arquivo para restaurar.')
  const stage = `${file}.restore-${randomUUID()}`
  const previous = `${stage}.previous`
  let promoted = false
  let keepPrevious = false
  try {
    copyFileSync(source, stage)
    inspect(stage)
    const prepared = openDatabase(stage)
    try {
      prepared
        .prepare(
          `SELECT id, ${PATIENT_FIELDS.join(', ')}, ativo, created_at, updated_at FROM patients LIMIT 0`
        )
        .all()
      prepared
        .prepare(
          'SELECT id, patient_id, inicio, fim, observacao, created_at, updated_at FROM appointments LIMIT 0'
        )
        .all()
    } finally {
      prepared.close()
    }
    const checkpoint = current.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[]
    if (checkpoint[0]?.busy !== 0)
      throw new Error('O banco está em uso. Feche outras conexões e tente restaurar novamente.')
    current.close()
    copyFileSync(file, previous)
    for (const suffix of ['-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true })
    renameSync(stage, file)
    promoted = true
    return openDatabase(file)
  } catch (error) {
    if (promoted) {
      try {
        for (const suffix of ['-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true })
        renameSync(previous, file)
      } catch (rollbackError) {
        keepPrevious = true
        throw new AggregateError(
          [error, rollbackError],
          `Não foi possível reabrir o banco. A cópia anterior foi preservada em ${previous}.`
        )
      }
    }
    throw error
  } finally {
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${stage}${suffix}`, { force: true })
    if (!keepPrevious) rmSync(previous, { force: true })
  }
}
