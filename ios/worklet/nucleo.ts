import SecretStream from '@hyperswarm/secret-stream'
import { z } from 'zod'
import type { DataTopic, IpcResult, LinkVia, RemoteProbe } from '../../desktop/src/shared/api'
import { SCHEMA_VERSION } from '../../desktop/src/main/db/migrations'
import {
  createSyncClient,
  pairWithServer,
  probeServer,
  type Address,
  type ClientStatus
} from '../../desktop/src/main/net/client'
import { createRemoteDialer, type Bootstrap } from '../../desktop/src/main/net/remote'

const hex = z
  .string()
  .regex(/^[0-9a-f]+$/)
  .max(128)
const nome = z.string().trim().min(1).max(60)
const endereco = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535)
})
const servidor = z.object({ chave: hex, nome, enderecos: z.array(endereco).max(8) })

export const entrada = z.discriminatedUnion('t', [
  z.object({ t: z.literal('iniciar'), semente: hex.length(64), nome }),
  z.object({
    t: z.literal('parear'),
    id: z.number().int().nonnegative(),
    endereco,
    codigo: z.string().max(40)
  }),
  z.object({ t: z.literal('conectar'), servidor }),
  z.object({
    t: z.literal('operacao'),
    id: z.number().int().nonnegative(),
    canal: z.string().max(60),
    args: z.array(z.unknown()).max(5)
  }),
  z.object({ t: z.literal('testar'), id: z.number().int().nonnegative() }),
  z.object({ t: z.literal('desconectar') })
])

export type Entrada = z.infer<typeof entrada>

export type Servidor = z.infer<typeof servidor>

export type Saida =
  | { t: 'pronto'; chave: string }
  | { t: 'estado'; status: ClientStatus; via: LinkVia | null }
  | { t: 'evento'; topics: DataTopic[] }
  | { t: 'resposta'; id: number; result: IpcResult<unknown> }
  | { t: 'falha'; mensagem: string }

export function criarNucleo(opcoes: {
  enviar: (saida: Saida) => void
  bootstrap?: Bootstrap
}): { receber(mensagem: unknown): void; fechar(): Promise<void> } {
  const { enviar } = opcoes
  let chaves: { publicKey: Buffer; secretKey: Buffer } | null = null
  let meuNome = 'iPhone'
  let atual: { cliente: ReturnType<typeof createSyncClient>; servidor: Servidor } | null = null
  let discador: ReturnType<typeof createRemoteDialer> | null = null

  function minhasChaves(): { publicKey: Buffer; secretKey: Buffer } {
    if (!chaves) throw new Error('O worklet ainda não foi iniciado.')
    return chaves
  }

  function responder(id: number, result: IpcResult<unknown>): void {
    enviar({ t: 'resposta', id, result })
  }

  function discar(): ReturnType<typeof createRemoteDialer> {
    discador ??= createRemoteDialer({ keyPair: minhasChaves(), bootstrap: opcoes.bootstrap })
    return discador
  }

  function desconectar(): void {
    atual?.cliente.close()
    atual = null
  }

  async function parear(id: number, alvo: Address, codigo: string): Promise<void> {
    try {
      const pareado = await pairWithServer({
        keyPair: minhasChaves(),
        name: meuNome,
        schemaVersion: SCHEMA_VERSION,
        address: alvo,
        code: codigo
      })
      responder(id, {
        ok: true,
        data: { chave: pareado.publicKey, nome: pareado.name, enderecos: [alvo] }
      })
    } catch (error) {
      responder(id, { ok: false, error: (error as Error).message })
    }
  }

  function conectar(alvo: Servidor): void {
    desconectar()
    const cliente = createSyncClient({
      keyPair: minhasChaves(),
      name: () => meuNome,
      schemaVersion: SCHEMA_VERSION,
      serverKey: alvo.chave,
      serverName: alvo.nome,
      addresses: async () => alvo.enderecos,
      dialRemote: () => discar().dial(alvo.chave),
      onStatus: (status) => enviar({ t: 'estado', status, via: cliente.via() }),
      onEvent: (topics) => enviar({ t: 'evento', topics })
    })
    atual = { cliente, servidor: alvo }
  }

  async function operacao(id: number, canal: string, args: unknown[]): Promise<void> {
    if (!atual) return responder(id, { ok: false, error: 'Nenhum computador conectado.' })
    responder(id, await atual.cliente.request(canal, args))
  }

  async function testar(id: number): Promise<void> {
    if (!atual) return responder(id, { ok: false, error: 'Nenhum computador conectado.' })
    const { servidor: alvo } = atual
    const resultado: RemoteProbe = await probeServer({
      open: () => discar().dial(alvo.chave),
      serverKey: alvo.chave,
      serverName: alvo.nome,
      name: meuNome,
      schemaVersion: SCHEMA_VERSION
    })
    responder(id, resultado.ok ? { ok: true, data: resultado } : resultado)
  }

  return {
    receber(mensagem) {
      const lida = entrada.safeParse(mensagem)
      if (!lida.success) return enviar({ t: 'falha', mensagem: 'Mensagem inválida do app.' })
      const m = lida.data
      switch (m.t) {
        case 'iniciar':
          chaves = SecretStream.keyPair(Buffer.from(m.semente, 'hex'))
          meuNome = m.nome
          return enviar({ t: 'pronto', chave: chaves.publicKey.toString('hex') })
        case 'parear':
          return void parear(m.id, m.endereco, m.codigo)
        case 'conectar':
          return conectar(m.servidor)
        case 'operacao':
          return void operacao(m.id, m.canal, m.args)
        case 'testar':
          return void testar(m.id)
        case 'desconectar':
          return desconectar()
      }
    },
    async fechar() {
      desconectar()
      await discador?.close()
      discador = null
    }
  }
}
