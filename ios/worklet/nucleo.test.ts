import test from 'brittle'
import { randomBytes } from 'node:crypto'
import { escreverConvite, lerConvite } from '../../desktop/src/main/net/convite'
import { API, criarNucleo, type Saida } from './nucleo'
import contratoGravado from '../Tests/Contrato/contrato-v1.json'

const [conviteDaRecepcao, conviteDoOutro, bootstrapTexto, modo, conviteDoAntigo, conviteDoNovo] =
  Bare.argv.slice(2)
const bootstrap = bootstrapTexto.split(',').map((endereco) => {
  const [host, port] = endereco.split(':')
  return { host, port: Number(port) }
})

type Resposta = Extract<Saida, { t: 'resposta' }>['result']

function cliente() {
  const recebidas: Saida[] = []
  const ouvintes = new Set<() => void>()
  let proximo = 1
  const nucleo = criarNucleo({
    enviar: (saida) => {
      recebidas.push(saida)
      for (const ouvinte of ouvintes) ouvinte()
    },
    bootstrap
  })
  nucleo.receber({
    t: 'iniciar',
    semente: randomBytes(32).toString('hex'),
    nome: 'iPhone de teste'
  })

  function esperar(filtro: (saida: Saida) => boolean, ms = 30_000): Promise<Saida> {
    return new Promise((resolve, reject) => {
      const conferir = (): boolean => {
        const achada = recebidas.find(filtro)
        if (!achada) return false
        ouvintes.delete(conferir)
        clearTimeout(tempo)
        resolve(achada)
        return true
      }
      const tempo = setTimeout(() => {
        ouvintes.delete(conferir)
        reject(new Error('tempo esgotado'))
      }, ms)
      if (!conferir()) ouvintes.add(conferir)
    })
  }

  async function pedir(mensagem: Record<string, unknown>): Promise<Resposta> {
    const id = proximo++
    nucleo.receber({ ...mensagem, id })
    const saida = (await esperar((s) => s.t === 'resposta' && s.id === id)) as Extract<
      Saida,
      { t: 'resposta' }
    >
    return saida.result
  }

  function esquecer(): void {
    recebidas.length = 0
  }

  return { nucleo, pedir, esperar, esquecer }
}

const dois = (n: number): string => String(n).padStart(2, '0')
const local = (data: Date, hora: number): string =>
  `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}T${dois(hora)}:00`

function proximoDia(dias: number): Date {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return data
}

function proximo(diaDaSemana: number): Date {
  const data = new Date()
  data.setDate(data.getDate() + 7 + ((diaDaSemana - data.getDay() + 7) % 7))
  return data
}

const recepcao = lerConvite(conviteDaRecepcao)!
const outro = lerConvite(conviteDoOutro)!
const iphone = cliente()
const celularDaRecepcao = cliente()

test('recusa QR code que não é do Auri', async (t) => {
  const resposta = await iphone.pedir({ t: 'parear', qr: 'https://exemplo.com.br' })
  t.alike(resposta, { ok: false, error: 'Este QR code não é do Auri.' })
})

test('recusa código errado', async (t) => {
  const qr = escreverConvite({ ...recepcao, codigo: 'ZZZZZZZZZZZZ' })
  const resposta = await iphone.pedir({ t: 'parear', qr })
  t.alike(resposta, {
    ok: false,
    error: 'Este QR code não vale mais. Gere outro no computador.'
  })
})

test('recusa computador que não é o do QR code, sem gastar o código dele', async (t) => {
  const qr = escreverConvite({ ...outro, chave: randomBytes(32).toString('hex') })
  const resposta = await iphone.pedir({ t: 'parear', qr })
  t.is(resposta.ok, false)
  t.ok(!resposta.ok && resposta.error.includes('não é o do QR code'))
})

test('pareia pelo QR code e usa a rede da clínica', async (t) => {
  const resposta = await iphone.pedir({ t: 'parear', qr: conviteDaRecepcao })
  t.ok(resposta.ok)
  const servidor = resposta.ok ? (resposta.data as { chave: string; nome: string }) : null
  t.is(servidor?.chave, recepcao.chave)
  t.is(servidor?.nome, 'Recepção de teste')

  iphone.nucleo.receber({ t: 'conectar', servidor })
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'connected' && s.via === 'local')
  const pacientes = await iphone.pedir({ t: 'operacao', canal: 'patients:list', args: [] })
  t.ok(pacientes.ok)
  t.ok(pacientes.ok && (pacientes.data as unknown[]).length >= 12)
})

test('conecta só pela internet', async (t) => {
  iphone.esquecer()
  iphone.nucleo.receber({
    t: 'conectar',
    servidor: { chave: recepcao.chave, nome: 'Recepção de teste', enderecos: [] }
  })
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'connected' && s.via === 'internet')
  const etiquetas = await iphone.pedir({ t: 'operacao', canal: 'tipos:list', args: [] })
  t.ok(etiquetas.ok)
  const teste = await iphone.pedir({ t: 'testar' })
  t.ok(teste.ok)
})

const OPERACOES_DO_IPHONE: [string, unknown[]][] = [
  ['patients:list', []],
  ['patients:get', [1]],
  ['appointments:listRange', ['2026-01-01T00:00', '2030-01-01T00:00']],
  ['appointments:listByPatient', [1]],
  ['commitments:listRange', ['2026-01-01T00:00', '2030-01-01T00:00']],
  ['tipos:list', []],
  ['anamneses:get', [1]],
  ['clinic:get', []]
]

const tipo = (valor: unknown): string =>
  valor === null ? 'null' : Array.isArray(valor) ? 'lista' : typeof valor

function conferir(esperado: unknown, atual: unknown, caminho: string, faltas: string[]): void {
  if (esperado === null || atual === null) return
  if (tipo(esperado) !== tipo(atual)) {
    faltas.push(`${caminho}: era ${tipo(esperado)}, veio ${tipo(atual)}`)
  } else if (Array.isArray(esperado) && Array.isArray(atual)) {
    if (esperado.length > 0 && atual.length > 0)
      conferir(esperado[0], atual[0], `${caminho}[0]`, faltas)
  } else if (tipo(esperado) === 'object') {
    const objeto = atual as Record<string, unknown>
    for (const [chave, valor] of Object.entries(esperado as Record<string, unknown>)) {
      if (!(chave in objeto)) faltas.push(`${caminho}.${chave} sumiu`)
      else conferir(valor, objeto[chave], `${caminho}.${chave}`, faltas)
    }
  }
}

test('o desktop responde no formato que o app do iPhone lê', async (t) => {
  const atual: Record<string, unknown> = {}
  for (const [canal, args] of OPERACOES_DO_IPHONE) {
    const resposta = await iphone.pedir({ t: 'operacao', canal, args })
    t.ok(resposta.ok)
    const dados = resposta.ok ? resposta.data : null
    atual[canal] = Array.isArray(dados) ? dados.slice(0, 1) : dados
  }
  if (modo === 'gravar') {
    console.log(`CONTRATO ${API} ${JSON.stringify(atual)}`)
    return
  }
  const faltas: string[] = []
  for (const [canal, esperado] of Object.entries(contratoGravado)) {
    conferir(esperado, atual[canal], canal, faltas)
  }
  t.alike(faltas, [], 'Se a mudança no desktop foi de propósito: npm run contrato')
})

test('vale a regra do computador: sem sessão no domingo', async (t) => {
  const domingo = proximo(0)
  const resposta = await iphone.pedir({
    t: 'operacao',
    canal: 'appointments:create',
    args: [{ patient_id: 1, inicio: local(domingo, 12), fim: local(domingo, 13), observacao: '' }]
  })
  t.alike(resposta, { ok: false, error: 'A clínica não abre no domingo.' })
})

test('marca, recusa horário ocupado e recebe o aviso da recepção', async (t) => {
  const quarta = proximo(3)
  const sessao = {
    patient_id: 1,
    inicio: local(quarta, 12),
    fim: local(quarta, 13),
    observacao: ''
  }
  const marcada = await iphone.pedir({
    t: 'operacao',
    canal: 'appointments:create',
    args: [sessao]
  })
  t.ok(marcada.ok)
  const repetida = await iphone.pedir({
    t: 'operacao',
    canal: 'appointments:create',
    args: [sessao]
  })
  t.is(repetida.ok, false)

  const aviso = (await iphone.esperar((s) => s.t === 'aviso')) as Extract<Saida, { t: 'aviso' }>
  t.ok(aviso.titulo.startsWith('Recepção marcou a sessão de'))
  const amanha = proximoDia(1)
  const aberto = amanha.getDay() === 0 ? proximoDia(2) : amanha
  t.ok(aviso.inicio.startsWith(local(aberto, 0).slice(0, 10)))
  t.ok(aviso.corpo.endsWith(`às ${aviso.inicio.slice(11, 16)}`))
  await iphone.esperar((s) => s.t === 'evento')
})

test('fecha a conexão ao suspender e volta ao retomar', async (t) => {
  iphone.esquecer()
  await iphone.nucleo.suspender()
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'offline')
  const parado = await iphone.pedir({ t: 'operacao', canal: 'tipos:list', args: [] })
  t.is(parado.ok, false)
  iphone.esquecer()
  iphone.nucleo.retomar()
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'connected')
  const etiquetas = await iphone.pedir({ t: 'operacao', canal: 'tipos:list', args: [] })
  t.ok(etiquetas.ok)
})

test('não suspende se o app volta logo', async (t) => {
  iphone.esquecer()
  const suspensao = iphone.nucleo.suspender()
  iphone.nucleo.retomar()
  await suspensao
  const etiquetas = await iphone.pedir({ t: 'operacao', canal: 'tipos:list', args: [] })
  t.ok(etiquetas.ok)
})

test('volta sozinho quando a conexão cai', async (t) => {
  iphone.esquecer()
  const derrubou = await iphone.pedir({ t: 'operacao', canal: 'teste:derrubar', args: [] })
  t.ok(derrubou.ok)
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'offline')
  iphone.esquecer()
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'connected')
  const etiquetas = await iphone.pedir({ t: 'operacao', canal: 'tipos:list', args: [] })
  t.ok(etiquetas.ok)
})

test('computador antigo, que não conhece o celular: pede para atualizar o computador', async (t) => {
  const outroIphone = cliente()
  const resposta = await outroIphone.pedir({ t: 'parear', qr: conviteDoAntigo })
  t.alike(resposta, {
    ok: false,
    error: 'Atualize o Auri do computador que guarda os dados.'
  })
  await outroIphone.nucleo.fechar()
})

test('computador que não aceita mais esta versão do app: pede para atualizar o app', async (t) => {
  const outroIphone = cliente()
  const resposta = await outroIphone.pedir({ t: 'parear', qr: conviteDoNovo })
  t.alike(resposta, {
    ok: false,
    error: 'Este app do Auri ficou desatualizado. Atualize o Auri do iPhone.'
  })
  await outroIphone.nucleo.fechar()
})

test('pareia pela internet, fora da rede da clínica', async (t) => {
  const qr = escreverConvite({ ...outro, enderecos: [] })
  const resposta = await celularDaRecepcao.pedir({ t: 'parear', qr })
  t.ok(resposta.ok)
  const servidor = resposta.ok ? (resposta.data as { chave: string }) : null
  t.is(servidor?.chave, outro.chave)
})

test('o celular da recepção não abre anamnese nem evolução, e só usa a lista dele', async (t) => {
  celularDaRecepcao.nucleo.receber({
    t: 'conectar',
    servidor: { chave: outro.chave, nome: 'Outro computador', enderecos: [] }
  })
  await celularDaRecepcao.esperar((s) => s.t === 'estado' && s.status === 'connected')
  const anamnese = await celularDaRecepcao.pedir({
    t: 'operacao',
    canal: 'anamneses:get',
    args: [1]
  })
  t.alike(anamnese, {
    ok: false,
    error: 'Este celular é da recepção: a anamnese e as evoluções não abrem nele.'
  })
  const sessoes = await celularDaRecepcao.pedir({
    t: 'operacao',
    canal: 'appointments:listRange',
    args: ['2020-01-01T00:00', '2040-01-01T00:00']
  })
  const evolucoes = sessoes.ok ? (sessoes.data as { evolucao: string }[]) : []
  t.ok(evolucoes.length > 0)
  t.ok(evolucoes.every((sessao) => sessao.evolucao === ''))
  const cadastro = await celularDaRecepcao.pedir({
    t: 'operacao',
    canal: 'patients:create',
    args: [{ nome: 'Paciente Fictício' }]
  })
  t.alike(cadastro, { ok: false, error: 'Não disponível no celular.' })
  await celularDaRecepcao.nucleo.fechar()
})

test('iPhone removido na recepção não recebe mais nada, por nenhum caminho', async (t) => {
  iphone.esquecer()
  iphone.nucleo.receber({
    t: 'conectar',
    servidor: { chave: recepcao.chave, nome: 'Recepção de teste', enderecos: recepcao.enderecos }
  })
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'connected' && s.via === 'local')
  iphone.esquecer()
  await iphone.pedir({ t: 'operacao', canal: 'teste:remover', args: [] })
  await iphone.esperar((s) => s.t === 'estado' && s.status === 'revoked')
  const pelaRede = await iphone.pedir({ t: 'operacao', canal: 'patients:list', args: [] })
  t.is(pelaRede.ok, false)

  iphone.nucleo.receber({
    t: 'conectar',
    servidor: { chave: recepcao.chave, nome: 'Recepção de teste', enderecos: [] }
  })
  const pelaInternet = await iphone.pedir({ t: 'operacao', canal: 'patients:list', args: [] })
  t.is(pelaInternet.ok, false)
})

test('fecha', async (t) => {
  await iphone.nucleo.fechar()
  t.pass()
})
