import { describe, expect, test } from 'vite-plus/test'
import {
  ALTURA,
  LARGURA,
  TOLERANCIAS,
  assinaturaMinima,
  codificar,
  codificarNoLimite,
  decodificar,
  paraQuadro,
  simplificar,
  tracoParaSvg,
  type Ponto
} from './traco'

function sorteio(semente: number): () => number {
  let estado = semente
  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function assinaturaFicticia(semente: number, tracos = 4, amostras = 400): Ponto[][] {
  const aleatorio = sorteio(semente)
  const largura = 800
  const altura = 320
  return Array.from({ length: tracos }, (_, t) => {
    const fase = aleatorio() * Math.PI * 2
    const voltas = 5 + aleatorio() * 6
    const inicio = 40 + (t * (largura - 80)) / tracos
    return Array.from({ length: amostras }, (_, i) => {
      const p = i / (amostras - 1)
      const x = inicio + (p * (largura - 80)) / tracos + 22 * Math.sin(p * voltas * 2 + fase)
      const y =
        altura / 2 + 70 * Math.sin(p * voltas + fase) * Math.cos(p * 3) + (aleatorio() - 0.5) * 2
      return paraQuadro(x, y, largura, altura)
    })
  })
}

function distanciaAoTraco([x, y]: Ponto, traco: readonly Ponto[]): number {
  if (traco.length === 1) return Math.hypot(x - traco[0][0], y - traco[0][1])
  let menor = Infinity
  for (let i = 1; i < traco.length; i++) {
    const [x1, y1] = traco[i - 1]
    const [x2, y2] = traco[i]
    const dx = x2 - x1
    const dy = y2 - y1
    const quadrado = dx * dx + dy * dy
    const t =
      quadrado === 0 ? 0 : Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / quadrado))
    menor = Math.min(menor, Math.hypot(x - x1 - t * dx, y - y1 - t * dy))
  }
  return menor
}

const pontosDe = (assinatura: readonly (readonly Ponto[])[]): number =>
  assinatura.reduce((total, traco) => total + traco.length, 0)

describe('quadro 5:2', () => {
  test('leva o ponto da tela a inteiros de 0 a 1000 por 0 a 400', () => {
    expect(paraQuadro(0, 0, 500, 200)).toEqual([0, 0])
    expect(paraQuadro(250, 100, 500, 200)).toEqual([500, 200])
    expect(paraQuadro(500, 200, 500, 200)).toEqual([LARGURA, ALTURA])
    expect(paraQuadro(123.4, 56.7, 500, 200)).toEqual([247, 113])
  })

  test('o ponto que sai do quadro fica na borda', () => {
    expect(paraQuadro(-30, 260, 500, 200)).toEqual([0, ALTURA])
    expect(paraQuadro(900, -1, 500, 200)).toEqual([LARGURA, 0])
  })
})

describe('simplificação', () => {
  test.each(TOLERANCIAS)(
    'todo ponto fica a até %i unidades do traço simplificado',
    (tolerancia) => {
      for (const semente of [1, 2, 3]) {
        for (const traco of assinaturaFicticia(semente)) {
          const simples = simplificar(traco, tolerancia)
          expect(simples[0]).toEqual(traco[0])
          expect(simples.at(-1)).toEqual(traco.at(-1))
          expect(simples.length).toBeLessThan(traco.length / 2)
          for (const ponto of traco) {
            expect(distanciaAoTraco(ponto, simples)).toBeLessThanOrEqual(tolerancia)
          }
        }
      }
    }
  )

  test('tolerância maior tira mais pontos', () => {
    const assinatura = assinaturaFicticia(7)
    const contagens = TOLERANCIAS.map((tolerancia) =>
      pontosDe(assinatura.map((traco) => simplificar(traco, tolerancia)))
    )
    expect(contagens).toEqual([...contagens].sort((a, b) => b - a))
    expect(contagens[0]).toBeGreaterThan(contagens.at(-1)!)
  })

  test('reta vira as duas pontas; pontos repetidos somem; o desvio maior que a tolerância fica', () => {
    const reta = Array.from({ length: 50 }, (_, i): Ponto => [100 + i * 10, 200])
    expect(simplificar(reta)).toEqual([
      [100, 200],
      [590, 200]
    ])
    expect(
      simplificar([
        [10, 10],
        [10, 10],
        [10, 10]
      ])
    ).toEqual([[10, 10]])
    expect(
      simplificar([
        [0, 0],
        [50, 3],
        [100, 0]
      ])
    ).toEqual([
      [0, 0],
      [50, 3],
      [100, 0]
    ])
  })

  test('traço que volta ao começo mantém a volta', () => {
    const laco: Ponto[] = [
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200],
      [100, 100]
    ]
    expect(simplificar(laco)).toEqual(laco)
  })
})

describe('codificação', () => {
  test('ida e volta devolvem a mesma assinatura', () => {
    for (const semente of [11, 12, 13, 14, 15]) {
      const assinatura = assinaturaFicticia(semente).map((traco) => simplificar(traco))
      expect(decodificar(codificar(assinatura))).toEqual(assinatura)
    }
    const extremos: Ponto[][] = [
      [[500, 200]],
      [
        [0, 0],
        [LARGURA, ALTURA],
        [0, ALTURA],
        [LARGURA, 0]
      ]
    ]
    expect(decodificar(codificar(extremos))).toEqual(extremos)
  })

  test('número de traços, número de pontos, primeiro ponto e diferenças em zigzag', () => {
    const bytes = codificar([
      [
        [300, 5],
        [301, 3],
        [301, 3]
      ]
    ])
    expect([...bytes]).toEqual([1, 3, 0xac, 0x02, 5, 2, 3, 0, 0])
  })

  test('traço vazio', () => {
    expect([...codificar([])]).toEqual([0])
    expect([...codificar([[], []])]).toEqual([0])
    expect(decodificar(Uint8Array.of(0))).toEqual([])
    expect(tracoParaSvg([])).toBe('')
    expect(assinaturaMinima([])).toBe(true)
    expect(assinaturaMinima([[]])).toBe(true)
  })

  test('recusa ponto fora do quadro ao codificar', () => {
    expect(() => codificar([[[LARGURA + 1, 0]]])).toThrow(RangeError)
    expect(() => codificar([[[10.5, 0]]])).toThrow(RangeError)
    expect(() => codificar([[[0, -1]]])).toThrow(RangeError)
  })

  test.each([
    ['sem bytes', []],
    ['cortado no meio', [1, 2, 10, 10, 2]],
    ['bytes sobrando', [1, 1, 10, 10, 0]],
    ['traço sem pontos', [1, 0]],
    ['número longo demais', [0x80, 0x80, 0x80, 0x80, 0x01]],
    ['número com zero sobrando', [0x81, 0x00, 1, 0, 0]],
    ['fora do quadro', [1, 1, 0xe9, 0x07, 0]],
    ['diferença que sai do quadro', [1, 2, 0, 0, 1, 0]]
  ])('recusa assinatura %s', (_, bytes) => {
    expect(() => decodificar(Uint8Array.from(bytes))).toThrow(RangeError)
  })
})

describe('tamanho', () => {
  test('assinaturas fictícias de 4 traços ficam perto de 2 bytes por ponto', () => {
    for (const semente of [21, 22, 23, 24, 25]) {
      const assinatura = assinaturaFicticia(semente).map((traco) => simplificar(traco))
      const bytes = codificar(assinatura)
      const pontos = pontosDe(assinatura)
      expect(bytes.length).toBeLessThan(800)
      expect(bytes.length).toBeLessThanOrEqual(1 + 4 * 6 + pontos * 2.2)
    }
  })

  test('sobe a tolerância até caber no limite, e desiste se nem assim couber', () => {
    const assinatura = assinaturaFicticia(31, 6, 600)
    const tamanhos = TOLERANCIAS.map(
      (tolerancia) => codificar(assinatura.map((traco) => simplificar(traco, tolerancia))).length
    )
    expect(codificarNoLimite(assinatura, tamanhos[0])).toEqual(
      codificar(assinatura.map((traco) => simplificar(traco)))
    )
    expect(codificarNoLimite(assinatura, tamanhos[0] - 1)?.length).toBe(tamanhos[1])
    expect(codificarNoLimite(assinatura, tamanhos[3])?.length).toBe(tamanhos[3])
    expect(codificarNoLimite(assinatura, tamanhos[3] - 1)).toBeNull()
  })
})

describe('desenho', () => {
  test('curvas quadráticas pelos pontos médios', () => {
    expect(tracoParaSvg([[10, 20]])).toBe('M10 20L10 20')
    expect(
      tracoParaSvg([
        [10, 20],
        [30, 40]
      ])
    ).toBe('M10 20L30 40')
    expect(
      tracoParaSvg([
        [0, 0],
        [10, 10],
        [21, 10],
        [30, 0]
      ])
    ).toBe('M0 0Q10 10 15.5 10Q21 10 25.5 5L30 0')
  })
})

describe('assinatura mínima', () => {
  test('menos de 2% da largura percorrida, somando os traços', () => {
    expect(assinaturaMinima([[[500, 200]]])).toBe(true)
    expect(
      assinaturaMinima([
        [
          [100, 100],
          [119, 100]
        ]
      ])
    ).toBe(true)
    expect(
      assinaturaMinima([
        [
          [100, 100],
          [110, 100]
        ],
        [
          [300, 100],
          [300, 110]
        ]
      ])
    ).toBe(false)
    expect(assinaturaMinima(assinaturaFicticia(41))).toBe(false)
  })
})
