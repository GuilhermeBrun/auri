import { networkInterfaces } from 'node:os'
import SecretStream from '@hyperswarm/secret-stream'
import QRCode from 'qrcode'
import { emptyPatientInput } from '../../desktop/src/shared/schemas'
import { openDatabase } from '../../desktop/src/main/db/connection'
import { SCHEMA_VERSION } from '../../desktop/src/main/db/migrations'
import { createPairingCodes } from '../../desktop/src/main/net/pairing'
import { createRemoteListener } from '../../desktop/src/main/net/remote'
import { createSyncServer } from '../../desktop/src/main/net/server'
import { runOperation } from '../../desktop/src/main/operations'
import { escreverConvite } from '../worklet/convite'

const PORTA = Number(process.argv[2] ?? 47391)

const db = openDatabase(':memory:')

function op<T>(canal: string, ...args: unknown[]): T {
  const resultado = runOperation(db, canal, args)
  if (!resultado.ok) throw new Error(`${canal}: ${resultado.error}`)
  return resultado.data as T
}

const dois = (n: number): string => String(n).padStart(2, '0')
const dia = (base: Date, deslocamento: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + deslocamento)
const local = (data: Date, hora: number, minuto = 0): string =>
  `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}T${dois(hora)}:${dois(minuto)}`

const FAMILIAS = [
  ['Ana Beatriz Teste', '2019-03-14', 'Mariana Teste'],
  ['Bruno Exemplo', '2017-08-02', 'Paula Exemplo'],
  ['Carla Fictícia', '2020-01-20', 'Fernanda Fictícia'],
  ['Davi Modelo', '2016-11-05', 'Luciana Modelo'],
  ['Elisa Simulada', '2018-06-30', 'Renata Simulada'],
  ['Felipe Demonstração', '2015-09-12', 'Juliana Demonstração'],
  ['Gabriela Amostra', '2019-12-01', 'Patrícia Amostra'],
  ['Heitor Ensaio', '2018-02-17', 'Camila Ensaio'],
  ['Isabela Protótipo', '2017-04-23', 'Aline Protótipo'],
  ['João Rascunho', '2016-07-09', 'Cristina Rascunho'],
  ['Lara Hipotética', '2020-10-11', 'Vanessa Hipotética'],
  ['Miguel Provisório', '2015-05-28', 'Simone Provisório']
]

const pacientes = FAMILIAS.map(([nome, nascimento, mae], i) =>
  op<{ id: number }>('patients:create', {
    ...emptyPatientInput(),
    nome,
    data_nascimento: nascimento,
    mae_nome: mae,
    mae_celular: `(11) 9${dois(80 + i)}00-00${dois(i)}`,
    resp_tipo: 'mae',
    escola: 'Escola Municipal Exemplo'
  })
)

type Tipo = { id: number; categoria: string; duracao: number }
op('tipos:save', null, { nome: 'Linguagem', categoria: 'sessao', cor: '#7c3aed', duracao: 45 })
op('tipos:save', null, { nome: 'Motricidade', categoria: 'sessao', cor: '#ea580c', duracao: 45 })
const tipos = op<Tipo[]>('tipos:list')
const deSessao = tipos.filter((t) => t.categoria === 'sessao')
const avaliacao = tipos.find((t) => t.categoria === 'avaliacao') ?? deSessao[0]
const compromisso = tipos.find((t) => t.categoria === 'compromisso')

const EVOLUCOES = [
  'Trabalhamos rimas e consciência fonológica com cartões. Boa participação.',
  'Exercícios de sopro e motricidade orofacial. Cansou no fim da sessão.',
  'Leitura compartilhada com perguntas sobre a história. Respondeu com frases completas.',
  'Jogo de memória com sons do ambiente. Melhorou a atenção auditiva.'
]

const hoje = new Date()
const HORAS = [8, 9, 10, 14, 15, 16]
for (let d = -21; d <= 42; d++) {
  const data = dia(hoje, d)
  const semana = data.getDay()
  if (semana === 0 || semana === 6) continue
  HORAS.forEach((hora, h) => {
    if ((d * 7 + h * 3) % 5 === 0) return
    const paciente = pacientes[(((d * 6 + h) % pacientes.length) + pacientes.length) % pacientes.length]
    const tipo =
      (d + h) % 7 === 0 ? avaliacao : deSessao[(((d + h) % deSessao.length) + deSessao.length) % deSessao.length]
    const inicio = new Date(data.getFullYear(), data.getMonth(), data.getDate(), hora)
    const fim = new Date(inicio.getTime() + tipo.duracao * 60_000)
    op('appointments:create', {
      patient_id: paciente.id,
      inicio: local(inicio, hora),
      fim: local(fim, fim.getHours(), fim.getMinutes()),
      observacao: '',
      tipo_id: tipo.id,
      evolucao: d < 0 ? EVOLUCOES[(d + h + 40) % EVOLUCOES.length] : undefined
    })
  })
  if (compromisso && semana === 5) {
    op('commitments:create', {
      etiqueta_id: compromisso.id,
      titulo: 'Reunião de equipe',
      inicio: local(data, 17),
      fim: local(data, 18),
      observacao: ''
    })
  }
}

op('anamneses:save', pacientes[0].id, {
  data: '2026-03-02',
  queixa: 'Troca de sons na fala (r por l) e dificuldade para contar histórias.',
  gestacao: 'Sem intercorrências.',
  alimentacao: 'Come de tudo, mastigação adequada.',
  sono: 'Dorme bem, cerca de 10 horas por noite.',
  desenvolvimento: 'Primeiras palavras com 1 ano e 2 meses.',
  saude: 'Otites de repetição até os 3 anos.',
  rotina: 'Escola pela manhã, natação às quartas.',
  terapias: 'Nenhuma antes.',
  observacoes: 'Família muito participativa.'
})

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
  handle: (canal, args, peer) => {
    console.log(`pedido: ${canal}`)
    return runOperation(db, canal, args, (topics, aviso) =>
      server.broadcast(topics, aviso ? { ...aviso, autor: 'iPhone' } : undefined, peer)
    )
  }
})

function enderecosDaRede(porta: number): { host: string; port: number }[] {
  const daRede = Object.values(networkInterfaces())
    .flat()
    .filter((rede) => rede && rede.family === 'IPv4' && !rede.internal)
    .map((rede) => ({ host: rede!.address, port: porta }))
  return [...daRede, { host: '127.0.0.1', port: porta }].slice(0, 8)
}

async function main(): Promise<void> {
  const porta = await server.listen({ port: PORTA })

  createRemoteListener({
    keyPair,
    isPaired: (chave) => pareados.has(chave),
    attach: server.attach,
    onReach: (alcance) => console.log(`pela internet: ${alcance}`)
  })

  const { code } = codes.issue()
  const convite = escreverConvite({
    chave: keyPair.publicKey.toString('hex'),
    codigo: code,
    enderecos: enderecosDaRede(porta)
  })
  console.log(await QRCode.toString(convite, { type: 'terminal', small: true }))
  await QRCode.toFile('build/qrcode.png', convite, { width: 480 })
  console.log(`porta ${porta}, versão do banco ${SCHEMA_VERSION}, QR code válido por 5 minutos`)
  console.log(`${pacientes.length} pacientes fictícios`)
  console.log(`convite ${convite}`)
}

void main()
