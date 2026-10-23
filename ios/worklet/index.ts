import { criarNucleo, type Saida } from './nucleo'

const { IPC } = Bare

function enviar(saida: Saida): void {
  IPC.write(Buffer.from(JSON.stringify(saida) + '\n'))
}

const nucleo = criarNucleo({ enviar })

let resto = ''

IPC.on('data', (dados: Buffer) => {
  const linhas = (resto + dados.toString()).split('\n')
  resto = linhas.pop() ?? ''
  if (resto.length > 2 * 1024 * 1024) resto = ''
  for (const linha of linhas) {
    if (!linha) continue
    let mensagem: unknown
    try {
      mensagem = JSON.parse(linha)
    } catch {
      enviar({ t: 'falha', mensagem: 'Mensagem inválida do app.' })
      continue
    }
    nucleo.receber(mensagem)
  }
})

Bare.on('suspend', () => {
  void nucleo.suspender()
})

Bare.on('resume', () => nucleo.retomar())

Bare.on('uncaughtException', (error: Error) => {
  enviar({ t: 'falha', mensagem: error.name })
})

Bare.on('unhandledRejection', (reason: unknown) => {
  enviar({ t: 'falha', mensagem: reason instanceof Error ? reason.name : 'Erro inesperado' })
})
