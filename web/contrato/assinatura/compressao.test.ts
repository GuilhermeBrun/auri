import { describe, expect, test } from 'vite-plus/test'
import { MAXIMO_DESCOMPRIMIDO, comprimir, descomprimir } from './compressao'
import { TEXTO_FICTICIO } from './ficticio'

const bytes = (texto: string): Uint8Array => new TextEncoder().encode(texto)

describe('deflate-raw', () => {
  test('ida e volta, menor que o original', async () => {
    const original = bytes(TEXTO_FICTICIO)
    const comprimido = await comprimir(original)
    expect(comprimido.length).toBeLessThan(original.length * 0.6)
    expect(await descomprimir(comprimido)).toEqual(original)
  })

  test('conteúdo vazio', async () => {
    expect(await descomprimir(await comprimir(new Uint8Array()))).toEqual(new Uint8Array())
  })

  test('recusa o que não é deflate', async () => {
    await expect(descomprimir(bytes('isto não é deflate'))).rejects.toThrow()
  })

  test('recusa deflate cortado', async () => {
    const comprimido = await comprimir(bytes(TEXTO_FICTICIO))
    await expect(descomprimir(comprimido.slice(0, comprimido.length - 8))).rejects.toThrow()
  })

  test('para de descomprimir acima do máximo', async () => {
    const bomba = await comprimir(new Uint8Array(MAXIMO_DESCOMPRIMIDO * 4))
    expect(bomba.length).toBeLessThan(1024)
    await expect(descomprimir(bomba)).rejects.toThrow(RangeError)
    expect(await descomprimir(bomba, Infinity)).toHaveLength(MAXIMO_DESCOMPRIMIDO * 4)
  })
})
