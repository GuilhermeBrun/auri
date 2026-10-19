import { describe, expect, test } from 'vite-plus/test'
import { TAMANHO_DA_CHAVE, cifrar, decifrar, novaChave, sha256 } from './cifra'

const bytes = (texto: string): Uint8Array => new TextEncoder().encode(texto)
const texto = (dados: Uint8Array): string => new TextDecoder().decode(dados)

describe('AES-256-GCM', () => {
  test('cada chave tem 32 bytes sorteados', () => {
    const [a, b] = [novaChave(), novaChave()]
    expect(a).toHaveLength(TAMANHO_DA_CHAVE)
    expect(a).not.toEqual(b)
  })

  test('decifra o que cifrou, com iv de 12 bytes e etiqueta de 16', async () => {
    const chave = novaChave()
    const pacote = await cifrar(chave, 'auri/teste', bytes('termo fictício'))
    expect(pacote).toHaveLength(12 + bytes('termo fictício').length + 16)
    expect(texto(await decifrar(chave, 'auri/teste', pacote))).toBe('termo fictício')
  })

  test('o iv muda a cada cifra', async () => {
    const chave = novaChave()
    const a = await cifrar(chave, 'auri/teste', bytes('igual'))
    const b = await cifrar(chave, 'auri/teste', bytes('igual'))
    expect(a.slice(0, 12)).not.toEqual(b.slice(0, 12))
  })

  test('recusa chave errada, dado adicional trocado e qualquer byte mudado', async () => {
    const chave = novaChave()
    const pacote = await cifrar(chave, 'auri/teste', bytes('termo fictício'))
    await expect(decifrar(novaChave(), 'auri/teste', pacote)).rejects.toThrow()
    await expect(decifrar(chave, 'auri/outro', pacote)).rejects.toThrow()
    for (const posicao of [0, 11, 12, pacote.length - 1]) {
      const mudado = pacote.slice()
      mudado[posicao] ^= 1
      await expect(decifrar(chave, 'auri/teste', mudado)).rejects.toThrow()
    }
    await expect(decifrar(chave, 'auri/teste', pacote.slice(0, 27))).rejects.toThrow(RangeError)
  })

  test('só aceita chave de 32 bytes', async () => {
    await expect(cifrar(new Uint8Array(16), 'auri/teste', bytes('x'))).rejects.toThrow(RangeError)
  })
})

describe('SHA-256', () => {
  test('em hexadecimal, do texto em UTF-8 ou dos bytes', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(await sha256(bytes('ação'))).toBe(await sha256('ação'))
  })
})
