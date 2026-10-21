import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from '../db/connection'
import { createPatient } from '../db/patients'
import { createKeyring, keyFromSecret, readHeader, unpackBackup, type Keyring } from './archive'
import {
  backupFileName,
  backupsToKeep,
  createBackup,
  extractBackup,
  listBackups,
  pruneBackups,
  reencryptBackups
} from './backup'
import { BackupFileError, newRecoveryCode, normalizeRecoveryCode, WrongSecretError } from './crypto'

const FAST = { N: 1024, r: 8, p: 1 }
const CODE = 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ'

let dir: string
let folder: string
let tmp: string
let db: Db
let keyring: Keyring

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'auri-copia-'))
  folder = join(dir, 'Drive', 'Auri', 'Cópias')
  tmp = join(dir, 'tmp')
  db = openDatabase(join(dir, 'auri.db'))
  createPatient(db, { ...emptyPatientInput(), nome: 'Ana Teste' })
  createPatient(db, { ...emptyPatientInput(), nome: 'Bruno Teste' })
  keyring = await createKeyring('senha-boa-123', CODE, FAST)
})

describe('código de recuperação', () => {
  it('tem 24 símbolos em grupos de 4, sem 0/O nem 1/I', () => {
    const code = newRecoveryCode()
    expect(code).toMatch(/^([A-HJ-NP-Z2-9]{4}-){5}[A-HJ-NP-Z2-9]{4}$/)
  })

  it('aceita o código digitado em minúsculas e com espaços', () => {
    expect(normalizeRecoveryCode(' abcd efgh-jklm ')).toBe('ABCDEFGHJKLM')
  })
})

describe('cópia de segurança', () => {
  it('cifra o banco e volta igual com a senha ou com o código', async () => {
    const entry = await createBackup({
      db,
      folder,
      keyring,
      tmpDir: tmp,
      now: new Date(2026, 9, 13, 19, 0)
    })
    expect(entry.name).toBe('Auri 2026-10-13 19h00.auribackup')
    expect(entry.counts).toEqual({ patients: 2, appointments: 0 })

    const file = readFileSync(entry.file)
    expect(file.includes(Buffer.from('Ana Teste'))).toBe(false)

    const header = readHeader(file)
    const byPassword = await keyFromSecret(header, { password: 'senha-boa-123' })
    const byCode = await keyFromSecret(header, { recoveryCode: 'abcd efgh jklm npqr stuv wxyz' })
    expect(byPassword.equals(keyring.key)).toBe(true)
    expect(byCode.equals(keyring.key)).toBe(true)

    const out = join(dir, 'restaurado.db')
    await extractBackup(entry.file, byPassword, out)
    const restored = openDatabase(out)
    const names = restored.prepare('SELECT nome FROM patients ORDER BY nome').all()
    expect(names).toEqual([{ nome: 'Ana Teste' }, { nome: 'Bruno Teste' }])
    restored.close()
  })

  it('recusa senha e código errados com mensagens próprias', async () => {
    const entry = await createBackup({ db, folder, keyring, tmpDir: tmp })
    const header = readHeader(readFileSync(entry.file))
    await expect(keyFromSecret(header, { password: 'outra' })).rejects.toThrow(WrongSecretError)
    await expect(keyFromSecret(header, { recoveryCode: 'AAAA' })).rejects.toThrow(
      'Código de recuperação incorreto.'
    )
  })

  it('percebe quando o cabeçalho foi alterado (as contagens não dão para falsificar)', async () => {
    const entry = await createBackup({ db, folder, keyring, tmpDir: tmp })
    const original = readFileSync(entry.file)
    const tampered = Buffer.from(
      original.toString('latin1').replace('"patients":2', '"patients":9'),
      'latin1'
    )
    expect(() => unpackBackup(tampered, keyring.key)).toThrow(BackupFileError)
  })

  it('não confunde outro arquivo com uma cópia', async () => {
    const other = join(dir, 'foto.auribackup')
    writeFileSync(other, 'não sou uma cópia')
    await expect(extractBackup(other, keyring.key, join(dir, 'x.db'))).rejects.toThrow(
      'não é uma cópia de segurança do Auri'
    )
    expect(await listBackups(dir)).toEqual([])
  })

  it('lista da mais nova para a mais antiga e apaga só as próprias que sobram', async () => {
    const other = await createKeyring('de-outro', newRecoveryCode(), FAST)
    await createBackup({ db, folder, keyring: other, tmpDir: tmp, now: new Date(2026, 9, 1, 8) })
    for (let hour = 9; hour <= 12; hour++) {
      await createBackup({ db, folder, keyring, tmpDir: tmp, now: new Date(2026, 9, 1, hour) })
    }
    const names = (await listBackups(folder)).map((e) => e.name)
    expect(names).toEqual([
      backupFileName(new Date(2026, 9, 1, 12)),
      backupFileName(new Date(2026, 9, 1, 11)),
      backupFileName(new Date(2026, 9, 1, 8))
    ])
    expect(await pruneBackups(folder, keyring.keyId)).toBe(0)
    expect(readdirSync(folder).every((name) => name.endsWith('.auribackup'))).toBe(true)
  })

  it('no mesmo minuto troca a própria cópia, mas nunca a de outro computador', async () => {
    const now = new Date(2026, 9, 13, 19, 0)
    const other = await createKeyring('de-outro', newRecoveryCode(), FAST)
    await createBackup({ db, folder, keyring: other, tmpDir: tmp, now })
    await createBackup({ db, folder, keyring, tmpDir: tmp, now })
    await createBackup({ db, folder, keyring, tmpDir: tmp, now })
    const entries = await listBackups(folder)
    const byName = (a: string[], b: string[]): number => a[0].localeCompare(b[0])
    expect(entries.map((e) => [e.name, e.keyId]).sort(byName)).toEqual(
      [
        ['Auri 2026-10-13 19h00.auribackup', other.keyId],
        ['Auri 2026-10-13 19h00 (2).auribackup', keyring.keyId]
      ].sort(byName)
    )
  })

  it('pasta que ainda não existe não tem cópias', async () => {
    expect(await listBackups(join(dir, 'nada'))).toEqual([])
  })

  it('recusa cópia de uma versão mais nova do Auri', async () => {
    db.pragma('user_version = 999')
    const entry = await createBackup({ db, folder, keyring, tmpDir: tmp })
    await expect(extractBackup(entry.file, keyring.key, join(dir, 'x.db'))).rejects.toThrow(
      'versão mais nova do Auri'
    )
  })
})

describe('troca de senha', () => {
  it('cifra de novo as cópias: a senha antiga deixa de abrir, a nova abre', async () => {
    await createBackup({ db, folder, keyring, tmpDir: tmp, now: new Date(2026, 9, 1, 19) })
    await createBackup({ db, folder, keyring, tmpDir: tmp, now: new Date(2026, 9, 2, 19) })
    const next = await createKeyring('senha-nova-456', newRecoveryCode(), FAST)

    expect(await reencryptBackups(folder, keyring, next)).toBe(2)

    for (const entry of await listBackups(folder)) {
      expect(entry.keyId).toBe(next.keyId)
      const header = readHeader(readFileSync(entry.file))
      await expect(keyFromSecret(header, { password: 'senha-boa-123' })).rejects.toThrow()
      const key = await keyFromSecret(header, { password: 'senha-nova-456' })
      expect(unpackBackup(readFileSync(entry.file), key).header.counts.patients).toBe(2)
    }
  })

  it('deixa como estão as cópias de outra chave', async () => {
    const other = await createKeyring('de-outro', newRecoveryCode(), FAST)
    await createBackup({ db, folder, keyring: other, tmpDir: tmp })
    const next = await createKeyring('senha-nova-456', newRecoveryCode(), FAST)
    expect(await reencryptBackups(folder, keyring, next)).toBe(0)
    expect((await listBackups(folder))[0].keyId).toBe(other.keyId)
  })
})

describe('quais cópias ficam', () => {
  const entry = (date: Date, name = backupFileName(date)): { name: string; createdAt: string } => ({
    name,
    createdAt: date.toISOString()
  })
  const kept = (entries: { name: string; createdAt: string }[]): string[] =>
    [...backupsToKeep(entries)].map((e) => e.name).sort()

  it('a cada alteração o dia vira uma cópia só, mais as duas últimas', () => {
    const day = Array.from({ length: 10 }, (_, i) => entry(new Date(2026, 9, 20, 8 + i)))
    const yesterday = Array.from({ length: 6 }, (_, i) => entry(new Date(2026, 9, 19, 8 + i)))
    expect(kept([...day, ...yesterday])).toEqual(
      [day[9], day[8], yesterday[5]].map((e) => e.name).sort()
    )
  })

  it('um ano de cópias diárias cabe em poucas, cobrindo dias, semanas e meses', () => {
    const start = new Date(2025, 9, 21, 19)
    const entries = Array.from({ length: 365 }, (_, i) =>
      entry(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 19))
    )
    const keep = [...backupsToKeep(entries)].map((e) => new Date(e.createdAt))
    expect(keep.length).toBeLessThanOrEqual(29)
    expect(keep.length).toBeGreaterThanOrEqual(22)
    const newest = new Date(2026, 9, 20, 19)
    const daysAgo = (d: Date): number => Math.round((newest.getTime() - d.getTime()) / 86_400_000)
    const ages = keep.map(daysAgo).sort((a, b) => a - b)
    expect(ages.slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(ages.at(-1)).toBeGreaterThanOrEqual(300)
    const months = new Set(keep.map((d) => `${d.getFullYear()}-${d.getMonth()}`))
    expect(months.size).toBe(12)
  })

  it('o dia é o do relógio da clínica, não o UTC', () => {
    const late = entry(new Date(2026, 9, 20, 23, 30))
    const evening = entry(new Date(2026, 9, 20, 20, 0))
    const morning = entry(new Date(2026, 9, 20, 8, 0))
    const yesterday = entry(new Date(2026, 9, 19, 23, 50))
    expect(kept([late, evening, morning, yesterday])).toEqual(
      [late.name, evening.name, yesterday.name].sort()
    )
  })

  it('cópias do mesmo minuto com (2) contam como qualquer outra', () => {
    const at = new Date(2026, 9, 20, 19)
    const first = entry(at)
    const second = entry(at, 'Auri 2026-10-20 19h00 (2).auribackup')
    const third = entry(at, 'Auri 2026-10-20 19h00 (3).auribackup')
    expect(kept([first, second, third])).toHaveLength(2)
  })

  it('nunca apaga cópia com data ilegível', () => {
    const odd = { name: 'estranha.auribackup', createdAt: 'ontem' }
    const days = Array.from({ length: 40 }, (_, i) => entry(new Date(2026, 9, 20 - i, 19)))
    expect(kept([odd, ...days])).toContain('estranha.auribackup')
  })

  it('computador desligado por semanas não apaga as cópias de antes', () => {
    const before = Array.from({ length: 6 }, (_, i) => entry(new Date(2026, 8, 1 + i, 19)))
    const after = entry(new Date(2026, 9, 20, 19))
    expect(kept([after, ...before])).toEqual([after, ...before].map((e) => e.name).sort())
  })
})

describe('limpeza na pasta', () => {
  it('ao copiar, apaga as próprias que sobram e deixa as de outro computador', async () => {
    const other = await createKeyring('de-outro', newRecoveryCode(), FAST)
    await createBackup({ db, folder, keyring: other, tmpDir: tmp, now: new Date(2026, 9, 20, 7) })
    for (let minute = 0; minute < 5; minute++) {
      await createBackup({
        db,
        folder,
        keyring,
        tmpDir: tmp,
        now: new Date(2026, 9, 20, 9, minute)
      })
    }
    const entries = await listBackups(folder)
    expect(entries.map((e) => [e.name, e.keyId === keyring.keyId])).toEqual([
      ['Auri 2026-10-20 09h04.auribackup', true],
      ['Auri 2026-10-20 09h03.auribackup', true],
      ['Auri 2026-10-20 07h00.auribackup', false]
    ])
  })

  it('não apaga a cópia que acabou de gravar, mesmo com outra de data adiante', async () => {
    for (const day of [25, 24]) {
      await createBackup({ db, folder, keyring, tmpDir: tmp, now: new Date(2026, 9, day, 19) })
    }
    const entry = await createBackup({
      db,
      folder,
      keyring,
      tmpDir: tmp,
      now: new Date(2026, 9, 24, 8)
    })
    expect((await listBackups(folder)).map((e) => e.file)).toContain(entry.file)
  })
})
