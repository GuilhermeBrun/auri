export const LARGURA = 1000
export const ALTURA = 400
export const ESPESSURA = 5
export const TOLERANCIAS = [2, 3, 4, 6] as const

const MINIMO_PERCORRIDO = LARGURA * 0.02

export type Ponto = readonly [x: number, y: number]
export type Traco = readonly Ponto[]
export type Assinatura = readonly Traco[]

function limitar(valor: number, maximo: number): number {
  return valor > maximo ? maximo : valor > 0 ? valor : 0
}

export function paraQuadro(x: number, y: number, largura: number, altura: number): Ponto {
  return [
    limitar(Math.round((x / largura) * LARGURA), LARGURA),
    limitar(Math.round((y / altura) * ALTURA), ALTURA)
  ]
}

function distanciaAoSegmento([x, y]: Ponto, [x1, y1]: Ponto, [x2, y2]: Ponto): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const quadrado = dx * dx + dy * dy
  const t = quadrado === 0 ? 0 : limitar(((x - x1) * dx + (y - y1) * dy) / quadrado, 1)
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy)
}

export function simplificar(traco: Traco, tolerancia: number = TOLERANCIAS[0]): Ponto[] {
  const pontos = traco.filter(
    ([x, y], i) => i === 0 || x !== traco[i - 1][0] || y !== traco[i - 1][1]
  )
  if (pontos.length < 3) return pontos
  const manter = new Uint8Array(pontos.length)
  manter[0] = 1
  manter[pontos.length - 1] = 1
  const pendentes: [number, number][] = [[0, pontos.length - 1]]
  for (let trecho = pendentes.pop(); trecho; trecho = pendentes.pop()) {
    const [inicio, fim] = trecho
    let maior = 0
    let indice = 0
    for (let i = inicio + 1; i < fim; i++) {
      const distancia = distanciaAoSegmento(pontos[i], pontos[inicio], pontos[fim])
      if (distancia > maior) {
        maior = distancia
        indice = i
      }
    }
    if (maior > tolerancia) {
      manter[indice] = 1
      pendentes.push([inicio, indice], [indice, fim])
    }
  }
  return pontos.filter((_, i) => manter[i] === 1)
}

function noQuadro([x, y]: Ponto): boolean {
  return (
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= LARGURA && y >= 0 && y <= ALTURA
  )
}

function escrever(bytes: number[], valor: number): void {
  let resto = valor
  while (resto >= 0x80) {
    bytes.push((resto & 0x7f) | 0x80)
    resto >>>= 7
  }
  bytes.push(resto)
}

const zigzag = (diferenca: number): number => (diferenca << 1) ^ (diferenca >> 31)
const desfazerZigzag = (valor: number): number => (valor >>> 1) ^ -(valor & 1)

export function codificar(assinatura: Assinatura): Uint8Array {
  const tracos = assinatura.filter((traco) => traco.length > 0)
  const bytes: number[] = []
  escrever(bytes, tracos.length)
  for (const traco of tracos) {
    if (!traco.every(noQuadro)) throw new RangeError('Ponto fora do quadro da assinatura')
    escrever(bytes, traco.length)
    escrever(bytes, traco[0][0])
    escrever(bytes, traco[0][1])
    for (let i = 1; i < traco.length; i++) {
      escrever(bytes, zigzag(traco[i][0] - traco[i - 1][0]))
      escrever(bytes, zigzag(traco[i][1] - traco[i - 1][1]))
    }
  }
  return Uint8Array.from(bytes)
}

export function decodificar(bytes: Uint8Array): Ponto[][] {
  let posicao = 0
  const invalido = (): Error => new RangeError('Assinatura inválida')
  const ler = (): number => {
    let valor = 0
    for (let deslocamento = 0; deslocamento < 28; deslocamento += 7) {
      if (posicao >= bytes.length) throw invalido()
      const byte = bytes[posicao++]
      if (byte === 0 && deslocamento > 0) throw invalido()
      valor |= (byte & 0x7f) << deslocamento
      if (byte < 0x80) return valor
    }
    throw invalido()
  }
  const assinatura: Ponto[][] = []
  for (let tracos = ler(); tracos > 0; tracos--) {
    const total = ler()
    if (total === 0) throw invalido()
    const traco: Ponto[] = [[ler(), ler()]]
    for (let i = 1; i < total; i++) {
      const [x, y] = traco[i - 1]
      traco.push([x + desfazerZigzag(ler()), y + desfazerZigzag(ler())])
    }
    if (!traco.every(noQuadro)) throw invalido()
    assinatura.push(traco)
  }
  if (posicao !== bytes.length) throw invalido()
  return assinatura
}

export function codificarNoLimite(assinatura: Assinatura, limite: number): Uint8Array | null {
  for (const tolerancia of TOLERANCIAS) {
    const bytes = codificar(assinatura.map((traco) => simplificar(traco, tolerancia)))
    if (bytes.length <= limite) return bytes
  }
  return null
}

export function tracoParaSvg(traco: Traco): string {
  if (traco.length === 0) return ''
  const [x0, y0] = traco[0]
  const [xn, yn] = traco[traco.length - 1]
  const curvas = traco
    .slice(1, -1)
    .map(([x, y], i) => `Q${x} ${y} ${(x + traco[i + 2][0]) / 2} ${(y + traco[i + 2][1]) / 2}`)
  return `M${x0} ${y0}${curvas.join('')}L${xn} ${yn}`
}

export function assinaturaMinima(assinatura: Assinatura): boolean {
  let percorrido = 0
  for (const traco of assinatura) {
    for (let i = 1; i < traco.length; i++) {
      percorrido += Math.hypot(traco[i][0] - traco[i - 1][0], traco[i][1] - traco[i - 1][1])
    }
  }
  return percorrido < MINIMO_PERCORRIDO
}
