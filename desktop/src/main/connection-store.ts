import { readFileSync, renameSync, writeFileSync } from 'fs'
import { z } from 'zod'

const hex = z.string().regex(/^[0-9a-f]+$/)

const storeSchema = z.object({
  role: z.enum(['server', 'client']).default('server'),
  /** Vazio: usa o nome do sistema. */
  name: z.string().max(60).default(''),
  keys: z
    .object({
      publicKey: hex,
      /** Hex, ou base64 cifrado pelo cofre do sistema quando `encrypted`. */
      secretKey: z.string(),
      encrypted: z.boolean()
    })
    .nullable()
    .default(null),
  sharing: z.boolean().default(false),
  keepRunning: z.boolean().default(true),
  openAtLogin: z.boolean().default(true),
  /** Aceitar conexões de fora da clínica (rede distribuída), além da rede local. */
  remoteAccess: z.boolean().default(true),
  devices: z
    .array(
      z.object({
        publicKey: hex,
        name: z.string(),
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

/**
 * Configurações da conexão num JSON ao lado do banco (`conexao.json`). Arquivo ausente ou inválido
 * vale como padrão: este computador guarda os dados e não compartilha. Gravação atômica (arquivo
 * temporário + renomear), para um desligamento no meio não deixar o arquivo pela metade e o
 * computador perder o pareamento.
 */
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
      store = { ...store, ...change }
      writeFileSync(`${file}.tmp`, JSON.stringify(store, null, 2))
      renameSync(`${file}.tmp`, file)
      return store
    }
  }
}
