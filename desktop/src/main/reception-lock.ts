import { setTimeout as sleep } from 'node:timers/promises'
import type { BackupSecret } from '../shared/api'
import type { BackupService } from './backup-service'
import type { PrefsStore } from './prefs'

export type ReceptionLock = {
  enable(): void
  disable(secret?: BackupSecret): Promise<void>
}

export function createReceptionLock(
  prefs: PrefsStore,
  backup: Pick<BackupService, 'hasPassword' | 'checkSecret'>,
  wrongDelayMs = 1000
): ReceptionLock {
  return {
    enable() {
      prefs.save({ recepcao: true })
    },

    async disable(secret) {
      if (!prefs.get().recepcao) return
      if (backup.hasPassword()) {
        if (!secret) throw new Error('Digite a senha da cópia de segurança.')
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
