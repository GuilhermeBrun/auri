import { readFileSync } from 'fs'
import { z } from 'zod'
import { DEVICE_KINDS, PHONE_LEVELS } from '../shared/api'
import { writeAtomicJson } from './atomic-file'

const hex = z.string().regex(/^[0-9a-f]+$/)

const storeSchema = z.object({
  role: z.enum(['server', 'client']).default('server'),
  name: z.string().max(60).default(''),
  keys: z
    .object({
      publicKey: hex,
      secretKey: z.string(),
      encrypted: z.boolean()
    })
    .nullable()
    .default(null),
  sharing: z.boolean().default(false),
  keepRunning: z.boolean().default(true),
  openAtLogin: z.boolean().default(true),
  remoteAccess: z.boolean().default(true),
  notices: z.boolean().default(true),
  devices: z
    .array(
      z.object({
        publicKey: hex,
        name: z.string(),
        tipo: z.enum(DEVICE_KINDS).default('computador'),
        nivel: z.enum(PHONE_LEVELS).nullable().default(null),
        lastSeen: z.string().nullable()
      })
    )
    .default([]),
  server: z
    .object({ publicKey: hex, name: z.string(), address: z.string().nullable() })
    .nullable()
    .default(null)
})

export type ConnectionStore = z.infer<typeof storeSchema>

export function createConnectionStore(file: string): {
  get(): ConnectionStore
  update(change: Partial<ConnectionStore>): ConnectionStore
} {
  let store: ConnectionStore
  try {
    store = storeSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    store = storeSchema.parse({})
  }
  return {
    get: () => store,
    update(change) {
      const next = { ...store, ...change }
      writeAtomicJson(file, next)
      store = next
      return store
    }
  }
}
