import { describe, expect, test } from 'vite-plus/test'
import { deBase64url, paraBase64url } from './base64url'

describe('base64url', () => {
  test('sem "=", com "-" e "_" no lugar de "+" e "/"', () => {
    expect(paraBase64url(new Uint8Array())).toBe('')
    expect(paraBase64url(Uint8Array.of(0xfb, 0xff))).toBe('-_8')
    expect(paraBase64url(new TextEncoder().encode('Auri'))).toBe('QXVyaQ')
  })

  test('ida e volta com todos os bytes e todos os restos', () => {
    const todos = Uint8Array.from({ length: 256 }, (_, i) => i)
    for (const tamanho of [0, 1, 2, 3, 4, 255, 256]) {
      const bytes = todos.slice(0, tamanho)
      expect(deBase64url(paraBase64url(bytes))).toEqual(bytes)
    }
  })

  test.each(['QXVyaQ==', 'QXVy aQ', 'QXVy+Q', 'QXVy/Q', 'Q', 'QXVyaR', 'é'])(
    'recusa %j',
    (texto) => {
      expect(() => deBase64url(texto)).toThrow(SyntaxError)
    }
  )
})
