import { setTimeout as sleep } from 'node:timers/promises'
import type { BackupSecret } from '../shared/api'
import type { BackupService } from './backup-service'
import type { PrefsStore } from './prefs'

export type ReceptionLock = {
  enable(password?: string): Promise<{ recoveryCode: string } | null>
  disable(secret?: BackupSecret): Promise<void>
}

export function createReceptionLock(
  prefs: PrefsStore,
  backup: Pick<BackupService, 'hasPassword' | 'checkSecret' | 'createPassword'>,
  wrongDelayMs = 1000
): ReceptionLock {
  return {
    async enable(password) {
      if (prefs.get().recepcao) return null
      if (backup.hasPassword()) {
        prefs.save({ recepcao: true })
        return null
      }
      if (!password) throw new Error('Crie uma senha para o computador da recepção.')
      const created = await backup.createPassword(password)
      prefs.save({ recepcao: true })
      return created
    },

    async disable(secret) {
      if (!prefs.get().recepcao) return
      if (backup.hasPassword()) {
        if (!secret) throw new Error('Digite a senha.')
        try {
          await backup.checkSecret(secret)
        } catch (error) {
          await sleep(wrongDelayMs)
          throw error
        }
      }
      prefs.save({ recepcao: false })
    }
  }
}
