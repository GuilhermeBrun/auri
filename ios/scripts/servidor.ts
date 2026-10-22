import SecretStream from '@hyperswarm/secret-stream'
import { SCHEMA_VERSION } from '../../desktop/src/main/db/migrations'
import { createPairingCodes, formatCode } from '../../desktop/src/main/net/pairing'
import { createRemoteListener } from '../../desktop/src/main/net/remote'
import { createSyncServer } from '../../desktop/src/main/net/server'

const PORTA = Number(process.argv[2] ?? 47391)

const PACIENTES = [
  { id: 1, nome: 'Ana Teste', ativo: 1 },
  { id: 2, nome: 'Bruno Exemplo', ativo: 1 },
  { id: 3, nome: 'Carla Fictícia', ativo: 1 }
]

const keyPair = SecretStream.keyPair()
const pareados = new Set<string>()
const codes = createPairingCodes()

const server = createSyncServer({
  keyPair,
  name: () => 'Recepção de teste',
  schemaVersion: SCHEMA_VERSION,
  isPaired: (chave) => pareados.has(chave),
  codes,
  onPaired: ({ publicKey, name }) => {
    pareados.add(publicKey)
    console.log(`pareado: ${name} (${publicKey.slice(0, 8)}…)`)
  },
  onPresence: (chave, online) => console.log(`${chave.slice(0, 8)}… ${online ? 'entrou' : 'saiu'}`),
  handle: (canal) => {
    console.log(`pedido: ${canal}`)
    if (canal === 'patients:list') return { ok: true, data: PACIENTES }
    return { ok: false, error: 'Operação desconhecida' }
  }
})

async function main(): Promise<void> {
  const porta = await server.listen({ port: PORTA })

  createRemoteListener({
    keyPair,
    isPaired: (chave) => pareados.has(chave),
    attach: server.attach,
    onReach: (alcance) => console.log(`pela internet: ${alcance}`)
  })

  const { code } = codes.issue()
  console.log(`porta ${porta}, versão do banco ${SCHEMA_VERSION}`)
  console.log(`chave ${keyPair.publicKey.toString('hex')}`)
  console.log(`código ${formatCode(code)} (5 minutos)`)
}

void main()
