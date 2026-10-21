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
  return {
    hasPassword: () => hasPassword,
    checkSecret: vi.fn(async (secret: BackupSecret) => {
      if ('password' in secret && secret.password !== 'senha-da-copia') {
        throw new Error('Senha incorreta.')
      }
    })
  }
}

describe('chave da recepção', () => {
  it('liga sem pedir nada e só desliga com a senha da cópia', async () => {
    const lock = createReceptionLock(prefs, backup(true), 0)
    lock.enable()
    expect(prefs.get().recepcao).toBe(true)

    await expect(lock.disable()).rejects.toThrow('senha da cópia')
    await expect(lock.disable({ password: 'errada' })).rejects.toThrow('Senha incorreta.')
    expect(prefs.get().recepcao).toBe(true)

    await lock.disable({ password: 'senha-da-copia' })
    expect(prefs.get().recepcao).toBe(false)
  })

  it('sem cópia de segurança neste computador, desliga direto', async () => {
    const lock = createReceptionLock(prefs, backup(false), 0)
    lock.enable()
    await lock.disable()
    expect(prefs.get().recepcao).toBe(false)
  })
})
