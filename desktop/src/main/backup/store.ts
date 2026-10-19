import { readFileSync, renameSync, writeFileSync } from 'fs'
import { z } from 'zod'
import { envelopeSchema } from './crypto'

const iso = z.string().nullable().default(null)

export const destinationSchema = z.object({
  kind: z.enum(['google', 'onedrive', 'icloud', 'folder']),
  folder: z.string().min(1)
})

const storeSchema = z.object({
  destination: destinationSchema.nullable().default(null),
  frequency: z.enum(['daily', 'change', 'manual']).default('daily'),
  dailyTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('19:00'),
  keyring: z
    .object({
      keyId: z.string(),
      key: z.string(),
      encrypted: z.boolean(),
      password: envelopeSchema,
      recovery: envelopeSchema
    })
    .nullable()
    .default(null),
  lastSuccessAt: iso,
  lastFile: iso,
  lastChangeAt: iso,
  lastError: z.object({ at: z.string(), message: z.string() }).nullable().default(null),
  undo: z.object({ file: z.string(), at: z.string() }).nullable().default(null),
  welcomeDone: z.boolean().default(false),
  suggested: z.enum(['google', 'onedrive', 'icloud', 'folder']).nullable().default(null)
})

export type BackupStore = z.infer<typeof storeSchema>

export function createBackupStore(file: string): {
  get(): BackupStore
  update(change: Partial<BackupStore>): BackupStore
} {
  let store: BackupStore
  try {
    store = storeSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    store = storeSchema.parse({})
  }
  return {
    get: () => store,
    update(change) {
      store = { ...store, ...change }
      writeFileSync(`${file}.tmp`, JSON.stringify(store, null, 2))
      renameSync(`${file}.tmp`, file)
      return store
    }
  }
}
