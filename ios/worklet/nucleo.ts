import SecretStream from '@hyperswarm/secret-stream'
import { z } from 'zod'
import type { DataTopic, IpcResult, LinkVia, RemoteProbe } from '../../desktop/src/shared/api'
import {
  createSyncClient,
  pairWithServer,
  PairingError,
  probeServer,
  type ClientStatus
} from '../../desktop/src/main/net/client'
import { lerConvite } from '../../desktop/src/main/net/convite'
import type { ApiRange } from '../../desktop/src/main/net/protocol'
import { createRemoteDialer, type Bootstrap } from '../../desktop/src/main/net/remote'
import { noticeText } from '../../desktop/src/shared/agenda-notice'

export const API = 1

const VERSAO = { api: API }

const ESPERA_DA_INTERNET_MS = 1_500

type Atualizar = 'app' | 'computador'

function quemAtualiza(aceita: ApiRange | null): Atualizar {
  return aceita && API < aceita.min ? 'app' : 'computador'
}

const ATUALIZE: Record<Atualizar, string> = {
  app: 'Este app do Auri ficou desatualizado. Atualize o Auri do iPhone.',
  computador: 'Atualize o Auri do computador que guarda os dados.'
}

const SEM_CAMINHO =
  'Não foi possível chegar ao computador. Confira se o Auri está aberto nele, com o ' +
  'compartilhamento e o acesso de fora da clínica ligados.'

const OUTRO_COMPUTADOR =
  'O computador que respondeu não é o do QR code. Gere outro QR code e tente de novo.'

function motivoDoPareamento(erro: unknown): string {
  if (!(erro instanceof PairingError)) return SEM_CAMINHO
  switch (erro.reason) {
    case 'version':
      return ATUALIZE[quemAtualiza(erro.accepted)]
    case 'code-none':
    case 'code-wrong':
      return 'Este QR code não vale mais. Gere outro no computador.'
    case 'code-expired':
      return 'O QR code venceu. Gere outro no computador.'
    case 'other-server':
      return OUTRO_COMPUTADOR
    case 'unreachable':
      return SEM_CAMINHO
    default:
      return 'O computador recusou a conexão. Gere outro QR code e tente de novo.'
  }
}

const decisivo = (erro: unknown): boolean =>
  erro instanceof PairingError && erro.reason !== 'unreachable' && erro.reason !== 'other-server'

function primeiroQueResponde<T>(
  locais: (() => Promise<T>)[],
  internet: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    let decidido = false
    let pendentes = locais.length + 1
    let internetComecou = false
    let ultimo: unknown = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const decidir = (fim: () => void): void => {
      decidido = true
      clearTimeout(timer)
      fim()
    }
    const seguir = (tentativa: Promise<T>): void => {
      tentativa.then(
        (valor) => {
          if (!decidido) decidir(() => resolve(valor))
        },
        (erro: unknown) => {
          if (decidido) return
          if (decisivo(erro)) return decidir(() => reject(erro))
          if (!(ultimo instanceof PairingError && ultimo.reason === 'other-server')) ultimo = erro
          pendentes--
          if (pendentes === 0) return decidir(() => reject(ultimo))
          if (pendentes === 1) comecarInternet()
        }
      )
    }
    const comecarInternet = (): void => {
      if (internetComecou || decidido) return
      internetComecou = true
      clearTimeout(timer)
      seguir(internet())
    }
    for (const local of locais) seguir(local())
    if (locais.length === 0) comecarInternet()
    else timer = setTimeout(comecarInternet, ESPERA_DA_INTERNET_MS)
  })
}

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
  z.object({
    t: z.literal('iniciar'),
    semente: hex.length(64),
    nome,
    bootstrap: z.array(endereco).max(8).optional()
  }),
  z.object({
    t: z.literal('parear'),
    id: z.number().int().nonnegative(),
    qr: z.string().max(2000)
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
  | { t: 'estado'; status: ClientStatus; via: LinkVia | null; atualizar?: Atualizar }
  | { t: 'evento'; topics: DataTopic[] }
  | { t: 'aviso'; titulo: string; corpo: string; inicio: string }
  | { t: 'resposta'; id: number; result: IpcResult<unknown> }
  | { t: 'falha'; mensagem: string }

export function criarNucleo(opcoes: { enviar: (saida: Saida) => void; bootstrap?: Bootstrap }): {
  receber(mensagem: unknown): void
  fechar(): Promise<void>
} {
  const { enviar } = opcoes
  let bootstrap = opcoes.bootstrap
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
    discador ??= createRemoteDialer({ keyPair: minhasChaves(), bootstrap })
    return discador
  }

  function desconectar(): void {
    atual?.cliente.close()
    atual = null
  }

  async function parear(id: number, qr: string): Promise<void> {
    const convite = lerConvite(qr)
    if (!convite) return responder(id, { ok: false, error: 'Este QR code não é do Auri.' })
    const comum = {
      keyPair: minhasChaves(),
      name: meuNome,
      version: VERSAO,
      code: convite.codigo,
      serverKey: convite.chave
    }
    try {
      const pareado = await primeiroQueResponde(
        convite.enderecos.map((address) => () => pairWithServer({ ...comum, address })),
        () =>
          pairWithServer({
            ...comum,
            open: () => discar().dial(convite.chave),
            unreachable: SEM_CAMINHO
          })
      )
      responder(id, {
        ok: true,
        data: { chave: pareado.publicKey, nome: pareado.name, enderecos: convite.enderecos }
      })
    } catch (error) {
      responder(id, { ok: false, error: motivoDoPareamento(error) })
    }
  }

  function conectar(alvo: Servidor): void {
    desconectar()
    const cliente = createSyncClient({
      keyPair: minhasChaves(),
      name: () => meuNome,
      version: VERSAO,
      serverKey: alvo.chave,
      serverName: alvo.nome,
      addresses: async () => alvo.enderecos,
      dialRemote: () => discar().dial(alvo.chave),
      onStatus: (status) =>
        enviar({
          t: 'estado',
          status,
          via: cliente.via(),
          atualizar: status === 'version' ? quemAtualiza(cliente.accepted()) : undefined
        }),
      onEvent: (topics, aviso) => {
        enviar({ t: 'evento', topics })
        if (!aviso) return
        const { title, body } = noticeText(aviso)
        enviar({ t: 'aviso', titulo: title, corpo: body, inicio: aviso.inicio })
      }
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
      version: VERSAO
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
          if (m.bootstrap) bootstrap = m.bootstrap
          return enviar({ t: 'pronto', chave: chaves.publicKey.toString('hex') })
        case 'parear':
          return void parear(m.id, m.qr)
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
