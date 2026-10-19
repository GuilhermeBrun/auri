export const MAXIMO_DESCOMPRIMIDO = 64 * 1024

async function passar(
  dados: Uint8Array,
  transformacao: CompressionStream | DecompressionStream,
  maximo: number
): Promise<Uint8Array<ArrayBuffer>> {
  const escritor = transformacao.writable.getWriter()
  void escritor.write(new Uint8Array(dados)).catch(() => {})
  void escritor.close().catch(() => {})
  const leitor = transformacao.readable.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (let parte = await leitor.read(); !parte.done; parte = await leitor.read()) {
    total += parte.value.length
    if (total > maximo) {
      await leitor.cancel().catch(() => {})
      throw new RangeError('Conteúdo grande demais')
    }
    partes.push(parte.value)
  }
  const saida = new Uint8Array(total)
  let posicao = 0
  for (const parte of partes) {
    saida.set(parte, posicao)
    posicao += parte.length
  }
  return saida
}

export function comprimir(dados: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  return passar(dados, new CompressionStream('deflate-raw'), Infinity)
}

export function descomprimir(
  dados: Uint8Array,
  maximo: number = MAXIMO_DESCOMPRIMIDO
): Promise<Uint8Array<ArrayBuffer>> {
  return passar(dados, new DecompressionStream('deflate-raw'), maximo)
}
