import { networkInterfaces } from 'node:os'
import SecretStream from '@hyperswarm/secret-stream'
import QRCode from 'qrcode'
import type { DeviceGrant, IpcResult } from '../../desktop/src/shared/api'
import { emptyPatientInput } from '../../desktop/src/shared/schemas'
import { openDatabase } from '../../desktop/src/main/db/connection'
import { SCHEMA_VERSION } from '../../desktop/src/main/db/migrations'
import {
  API_ATUAL,
  API_MINIMA,
  callAsDevice,
  deviceRecord,
  type DeviceRecord
} from '../../desktop/src/main/net/celular'
import { escreverConvite } from '../../desktop/src/main/net/convite'
import { createPairingCodes } from '../../desktop/src/main/net/pairing'
import { createRemoteListener } from '../../desktop/src/main/net/remote'
import { createSyncServer } from '../../desktop/src/main/net/server'
import { runOperation } from '../../desktop/src/main/operations'

const PORTA = Number(process.argv[2] ?? 47391)
const NOME = process.env.AURI_NOME ?? 'Recepção de teste'
const CODIGO: DeviceGrant =
  process.env.AURI_TIPO === 'computador'
    ? { tipo: 'computador' }
    : { tipo: 'celular', nivel: process.env.AURI_NIVEL === 'recepcao' ? 'recepcao' : 'fono' }
const API = process.env.AURI_API
  ? { min: Number(process.env.AURI_API), max: Number(process.env.AURI_API) }
  : { min: API_MINIMA, max: API_ATUAL }
const BOOTSTRAP = process.env.AURI_BOOTSTRAP?.split(',').map((endereco) => {
  const [host, port] = endereco.split(':')
  return { host, port: Number(port) }
})

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

const pacientes = (process.env.AURI_VAZIO ? [] : FAMILIAS).map(([nome, nascimento, mae], i) =>
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
const livresParaOTeste = new Set([0, 1, 2].map((n) => (hoje.getHours() + n) % 24))
for (let d = -21; d <= 42 && pacientes.length > 0; d++) {
  const data = dia(hoje, d)
  const semana = data.getDay()
  if (semana === 0 || semana === 6) continue
  HORAS.forEach((hora, h) => {
    if ((d * 7 + h * 3) % 5 === 0 || livresParaOTeste.has(hora)) return
    const paciente =
      pacientes[(((d * 6 + h) % pacientes.length) + pacientes.length) % pacientes.length]
    const tipo =
      (d + h) % 7 === 0
        ? avaliacao
        : deSessao[(((d + h) % deSessao.length) + deSessao.length) % deSessao.length]
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

if (pacientes.length > 0) {
  const arrastavel = op<{ id: number }>('patients:create', {
    ...emptyPatientInput(),
    nome: 'Rui Arrastável',
    data_nascimento: '2018-06-15'
  })
  const amanha = dia(hoje, 1)
  const diaDoRui = amanha.getDay() === 0 ? dia(amanha, 1) : amanha
  const hora = diaDoRui.getDay() === 6 ? 11 : 12
  op('appointments:create', {
    patient_id: arrastavel.id,
    inicio: local(diaDoRui, hora),
    fim: local(diaDoRui, hora, 30),
    observacao: '',
    tipo_id: deSessao[0].id
  })
}

op('clinic:save', {
  nome: 'Clínica de Teste',
  documento: '',
  endereco: '',
  telefone: '',
  whatsapp: '(11) 90000-0000',
  profissional: 'Fono de Teste',
  registro: '',
  logo: ''
})

type Marcada = { id: number; patient_id: number; inicio: string }
const doDia = (data: Date): Marcada[] =>
  op<Marcada[]>('appointments:listRange', local(data, 0), local(dia(data, 1), 0))
let comEstados = hoje
for (let d = 1; d < 7 && doDia(comEstados).length < 3; d++) comEstados = dia(hoje, d)
const [confirmada, faltou] = pacientes.length > 0 ? doDia(comEstados) : []
const daquiAPouco = local(
  new Date(hoje.getTime() + 2 * 3600_000),
  new Date(hoje.getTime() + 2 * 3600_000).getHours()
)
const aguardando = Array.from({ length: 7 }, (_, d) => doDia(dia(hoje, d)))
  .flat()
  .find((s) => s.inicio >= daquiAPouco && s.id !== confirmada?.id && s.id !== faltou?.id)
if (confirmada) {
  db.prepare("UPDATE appointments SET confirmado_em = datetime('now') WHERE id = ?").run(
    confirmada.id
  )
  db.prepare('UPDATE patients SET data_nascimento = ? WHERE id = ?').run(
    `2019-${dois(comEstados.getMonth() + 1)}-${dois(comEstados.getDate())}`,
    confirmada.patient_id
  )
}
if (faltou) db.prepare("UPDATE appointments SET presenca = 'falta' WHERE id = ?").run(faltou.id)
if (aguardando) {
  try {
    op('confirmacoes:enviar', aguardando.id, 'Recepção')
  } catch (error) {
    console.log(`sem pedido de confirmação de teste: ${(error as Error).message}`)
  }
}

if (pacientes.length > 0)
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
const pareados = new Map<string, DeviceRecord>()
const codes = createPairingCodes()

const server = createSyncServer({
  keyPair,
  name: () => NOME,
  schemaVersion: SCHEMA_VERSION,
  api: API,
  device: (chave) => pareados.get(chave) ?? null,
  codes,
  onPaired: ({ publicKey, name, ...grant }) => {
    const aparelho = deviceRecord(name, grant)
    pareados.set(publicKey, aparelho)
    console.log(`pareado: ${name}, ${aparelho.tipo} ${aparelho.nivel ?? ''}`)
  },
  onPresence: (chave, online) => console.log(`${chave.slice(0, 8)}… ${online ? 'entrou' : 'saiu'}`),
  handle: (canal, args, peer) => {
    console.log(`pedido: ${canal}`)
    if (canal === 'teste:derrubar' || canal === 'teste:remover') {
      if (canal === 'teste:remover') pareados.delete(peer.publicKey)
      setTimeout(() => server.disconnect(peer.publicKey), 100)
      return { ok: true, data: null }
    }
    const operar = (c: string, a: unknown[]): IpcResult<unknown> =>
      runOperation(db, c, a, (topics, aviso) =>
        server.broadcast(
          topics,
          aviso ? { ...aviso, autor: pareados.get(peer.publicKey)?.name ?? 'iPhone' } : undefined,
          peer.publicKey
        )
      )
    const resultado = callAsDevice(operar, pareados.get(peer.publicKey), peer, canal, args)
    if (process.env.AURI_AVISO && canal === 'appointments:create' && resultado.ok) {
      setTimeout(mudarPelaRecepcao, 5_000)
    }
    return resultado
  }
})

function mudarPelaRecepcao(): void {
  const amanha = dia(new Date(), 1)
  const aberto = amanha.getDay() === 0 ? dia(amanha, 1) : amanha
  for (const hora of [8, 11, 17]) {
    const resultado = runOperation(
      db,
      'appointments:create',
      [
        {
          patient_id: pacientes[1].id,
          inicio: local(aberto, hora),
          fim: local(aberto, hora, 45),
          observacao: '',
          tipo_id: deSessao[1].id
        }
      ],
      (topics, aviso) =>
        server.broadcast(topics, aviso ? { ...aviso, autor: 'Recepção' } : undefined)
    )
    if (resultado.ok) {
      console.log(`a recepção marcou uma sessão para ${local(aberto, hora)}`)
      return
    }
  }
}

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
    codes,
    attach: server.attach,
    onReach: (alcance) => console.log(`pela internet: ${alcance}`),
    bootstrap: BOOTSTRAP
  })

  const { code } = codes.issue(CODIGO)
  const convite = escreverConvite({
    chave: keyPair.publicKey.toString('hex'),
    codigo: code,
    enderecos: enderecosDaRede(porta)
  })
  console.log(await QRCode.toString(convite, { type: 'terminal', small: true }))
  await QRCode.toFile('build/qrcode.png', convite, { width: 480 })
  const nivel = CODIGO.tipo === 'celular' ? ` (${CODIGO.nivel})` : ''
  console.log(`porta ${porta}, código de ${CODIGO.tipo}${nivel}, api ${API.min} a ${API.max}`)
  console.log('QR code válido por 5 minutos')
  console.log(`${pacientes.length} pacientes fictícios`)
  console.log(`convite ${convite}`)
}

void main()
