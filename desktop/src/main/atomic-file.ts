import { randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs'

/** Grava no mesmo volume e só substitui o arquivo completo, depois de persistir os bytes. */
export function writeAtomicJson(file: string, value: unknown): void {
  const temporary = `${file}.${randomUUID()}.tmp`
  let handle: number | undefined
  try {
    handle = openSync(temporary, 'wx', 0o600)
    writeFileSync(handle, JSON.stringify(value))
    fsyncSync(handle)
    closeSync(handle)
    handle = undefined
    renameSync(temporary, file)
  } finally {
    if (handle !== undefined) closeSync(handle)
    rmSync(temporary, { force: true })
  }
}
