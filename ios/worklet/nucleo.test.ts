import test from 'brittle'
import { randomBytes } from 'node:crypto'
import { lerConvite, escreverConvite } from './convite'
import { criarNucleo, type Saida } from './nucleo'
import contratoGravado from '../Tests/Contrato/contrato.json'

const [conviteDaRecepcao, conviteDoOutro, bootstrapTexto, modo, conviteDoAntigo] =
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

test('recusa QR code que não é do Auri', async (t) => {
  const resposta = await iphone.pedir({ t: 'parear', qr: 'https://exemplo.com.br' })
  t.alike(resposta, { ok: false, error: 'Este QR code não é do Auri.' })
})

test('recusa código errado', async (t) => {
  const qr = escreverConvite({ ...recepcao, codigo: 'ZZZZZZZZZZZZ' })
  const resposta = await iphone.pedir({ t: 'parear', qr })
  t.is(resposta.ok, false)
  t.ok(!resposta.ok && resposta.error.startsWith('Código incorreto'))
})

test('recusa computador que não é o do QR code', async (t) => {
  const qr = escreverConvite({ ...outro, chave: recepcao.chave })
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
  t.is(pacientes.ok && (pacientes.data as unknown[]).length, 12)
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
  ['anamneses:get', [1]]
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
    console.log(`CONTRATO ${JSON.stringify(atual)}`)
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
  t.is(aviso.inicio, local(aberto, 11))
  t.ok(aviso.corpo.endsWith('às 11:00'))
  await iphone.esperar((s) => s.t === 'evento')
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

test('recusa computador com outra versão do Auri', async (t) => {
  const outroIphone = cliente()
  const resposta = await outroIphone.pedir({ t: 'parear', qr: conviteDoAntigo })
  t.is(resposta.ok, false)
  t.ok(!resposta.ok && resposta.error.includes('versões diferentes'))
  await outroIphone.nucleo.fechar()
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
