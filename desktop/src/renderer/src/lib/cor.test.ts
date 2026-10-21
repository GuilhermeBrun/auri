import { describe, expect, it } from 'vite-plus/test'
import { CORES_PRONTAS } from '@shared/tipos'
import { hexParaHsv, hsvParaHex } from './cor'

describe('roda de cor', () => {
  it('converte hex em matiz, saturação e brilho e volta', () => {
    expect(hexParaHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 })
    expect(hexParaHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
    expect(hsvParaHex({ h: 120, s: 100, v: 100 })).toBe('#00ff00')
    expect(hsvParaHex({ h: 240, s: 50, v: 50 })).toBe('#404080')
  })

  it('as cores prontas sobrevivem à ida e volta quase sem mudar', () => {
    for (const { cor } of CORES_PRONTAS) {
      const volta = hsvParaHex(hexParaHsv(cor))
      const canais = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      const diferenca = canais(cor).map((c, i) => Math.abs(c - canais(volta)[i]))
      expect(Math.max(...diferenca)).toBeLessThanOrEqual(3)
    }
  })
})
