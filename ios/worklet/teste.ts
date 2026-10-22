import { randomBytes } from 'node:crypto'
import { criarNucleo, type Saida } from './nucleo'

const [host, porta, codigo, rota] = Bare.argv.slice(2)

let proximo = 1
const esperando = new Map<number, (saida: Extract<Saida, { t: 'resposta' }>) => void>()

const nucleo = criarNucleo({
  enviar: (saida) => {
    if (saida.t === 'resposta') return esperando.get(saida.id)?.(saida)
    console.log(JSON.stringify(saida))
  }
})

function pedir(mensagem: Record<string, unknown>): Promise<Extract<Saida, { t: 'resposta' }>> {
  const id = proximo++
  return new Promise((resolve) => {
    esperando.set(id, resolve)
    nucleo.receber({ ...mensagem, id })
  })
}

async function main(): Promise<void> {
  const semente = randomBytes(32)
  nucleo.receber({ t: 'iniciar', semente: semente.toString('hex'), nome: 'iPhone de teste' })

  const pareado = await pedir({ t: 'parear', endereco: { host, port: Number(porta) }, codigo })
  console.log('parear', JSON.stringify(pareado.result))
  if (!pareado.result.ok) throw new Error('não pareou')

  const servidor = pareado.result.data as { chave: string; nome: string; enderecos: unknown[] }
  nucleo.receber({
    t: 'conectar',
    servidor: rota === 'internet' ? { ...servidor, enderecos: [] } : servidor
  })

  const lista = await pedir({ t: 'operacao', canal: 'patients:list', args: [] })
  console.log('patients:list', JSON.stringify(lista.result))

  const teste = await pedir({ t: 'testar' })
  console.log('testar pela internet', JSON.stringify(teste.result))

  await nucleo.fechar()
}

void main()
