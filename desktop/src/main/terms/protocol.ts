export const ESQUEMA = 'auri'

const MAXIMO = 8 * 1024
const RECEBER = /^auri:(?:\/\/)?receber(?:\/|#|\?r=)+(\d+\.[\w-]+\.[\w-]+)\/?$/i

export function respostaDoEndereco(endereco: string): string | null {
  if (endereco.length > MAXIMO) return null
  return RECEBER.exec(endereco.trim())?.[1] ?? null
}

export function enderecoNosArgumentos(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${ESQUEMA}:`)) ?? null
}

export type Caixa = {
  receber(endereco: string): boolean
  retirar(): string[]
}

export function criarCaixa(avisar: () => void): Caixa {
  let fila: string[] = []
  return {
    receber(endereco) {
      const resposta = respostaDoEndereco(endereco)
      if (!resposta) return false
      if (!fila.includes(resposta)) fila.push(resposta)
      avisar()
      return true
    },
    retirar() {
      const tudo = fila
      fila = []
      return tudo
    }
  }
}
