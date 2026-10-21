type Tamanho = { width: number; height: number }

const PADRAO: Tamanho = { width: 1280, height: 820 }
const MINIMO: Tamanho = { width: 1000, height: 640 }

export function tamanhoDaJanela(area: Tamanho): Tamanho & {
  minWidth: number
  minHeight: number
} {
  const caber = (valor: number, limite: number): number => Math.min(valor, Math.floor(limite))
  return {
    width: caber(PADRAO.width, area.width),
    height: caber(PADRAO.height, area.height),
    minWidth: caber(MINIMO.width, area.width),
    minHeight: caber(MINIMO.height, area.height)
  }
}
