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

  it('lista da mais nova para a mais antiga e guarda só as últimas', async () => {
    for (let day = 1; day <= 4; day++) {
      await createBackup({ db, folder, keyring, tmpDir: tmp, now: new Date(2026, 9, day, 19) })
    }
    await pruneBackups(folder, 2)
    const names = (await listBackups(folder)).map((e) => e.name)
    expect(names).toEqual([
      backupFileName(new Date(2026, 9, 4, 19)),
      backupFileName(new Date(2026, 9, 3, 19))
    ])
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
