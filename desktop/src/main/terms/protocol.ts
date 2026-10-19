export const ESQUEMA = 'auri'

const MAXIMO = 8 * 1024
const ENDERECO = /^auri:(?:\/\/)?(receber|confirmacao)(?:\/|#|\?r=)+(\d+\.[\w-]+\.[\w-]+)\/?$/i

export type Recebido = { tipo: 'termo' | 'confirmacao'; fragmento: string }

export function lerEndereco(endereco: string): Recebido | null {
  if (endereco.length > MAXIMO) return null
  const achado = ENDERECO.exec(endereco.trim())
  if (!achado) return null
  const tipo = achado[1].toLowerCase() === 'receber' ? 'termo' : 'confirmacao'
  return { tipo, fragmento: achado[2] }
}

export function enderecoNosArgumentos(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${ESQUEMA}:`)) ?? null
}

export type Caixa = {
  receber(endereco: string): boolean
  retirar(): string[]
  retirarConfirmacoes(): string[]
}

export function criarCaixa(avisar: () => void): Caixa {
  const filas: Record<Recebido['tipo'], string[]> = { termo: [], confirmacao: [] }
  const esvaziar = (tipo: Recebido['tipo']): string[] => {
    const tudo = filas[tipo]
    filas[tipo] = []
    return tudo
  }
  return {
    receber(endereco) {
      const recebido = lerEndereco(endereco)
      if (!recebido) return false
      const fila = filas[recebido.tipo]
      if (!fila.includes(recebido.fragmento)) fila.push(recebido.fragmento)
      avisar()
      return true
    },
    retirar: () => esvaziar('termo'),
    retirarConfirmacoes: () => esvaziar('confirmacao')
  }
}
