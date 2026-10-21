import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { BackupSecret } from '../shared/api'
import { createPrefsStore, type PrefsStore } from './prefs'
import { createReceptionLock } from './reception-lock'

let prefs: PrefsStore

beforeEach(() => {
  prefs = createPrefsStore(join(mkdtempSync(join(tmpdir(), 'auri-recepcao-')), 'prefs.json'))
})

function backup(hasPassword: boolean) {
  let senha: string | null = hasPassword ? 'senha-da-copia' : null
  return {
    hasPassword: () => senha !== null,
    createPassword: vi.fn(async (password: string) => {
      senha = password
      return { recoveryCode: 'CODIGO' }
    }),
    checkSecret: vi.fn(async (secret: BackupSecret) => {
      if ('password' in secret && secret.password !== senha) {
        throw new Error('Senha incorreta.')
      }
    })
  }
}

describe('chave da recepção', () => {
  it('com a senha da cópia, liga sem pedir nada e só desliga com ela', async () => {
    const copia = backup(true)
    const lock = createReceptionLock(prefs, copia, 0)
    await expect(lock.enable()).resolves.toBeNull()
    expect(prefs.get().recepcao).toBe(true)
    expect(copia.createPassword).not.toHaveBeenCalled()

    await expect(lock.disable()).rejects.toThrow('Digite a senha.')
    await expect(lock.disable({ password: 'errada' })).rejects.toThrow('Senha incorreta.')
    expect(prefs.get().recepcao).toBe(true)

    await lock.disable({ password: 'senha-da-copia' })
    expect(prefs.get().recepcao).toBe(false)
  })

  it('sem senha neste computador, ligar cria a senha que a cópia também vai usar', async () => {
    const copia = backup(false)
    const lock = createReceptionLock(prefs, copia, 0)
    await expect(lock.enable()).rejects.toThrow('Crie uma senha')
    expect(prefs.get().recepcao).toBe(false)

    await expect(lock.enable('senha-nova-1')).resolves.toEqual({ recoveryCode: 'CODIGO' })
    expect(prefs.get().recepcao).toBe(true)
    expect(copia.hasPassword()).toBe(true)

    await expect(lock.disable()).rejects.toThrow('Digite a senha.')
    await lock.disable({ password: 'senha-nova-1' })
    expect(prefs.get().recepcao).toBe(false)
  })

  it('ligada antes de existir senha, desliga direto', async () => {
    prefs.save({ recepcao: true })
    const lock = createReceptionLock(prefs, backup(false), 0)
    await lock.disable()
    expect(prefs.get().recepcao).toBe(false)
  })
})
