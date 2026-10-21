import { MIN_WINDOW } from '../shared/aparencia'

type Tamanho = { width: number; height: number }

const PADRAO: Tamanho = { width: 1280, height: 820 }

export function tamanhoDaJanela(area: Tamanho): Tamanho & {
  minWidth: number
  minHeight: number
} {
  const caber = (valor: number, limite: number): number => Math.min(valor, Math.floor(limite))
  return {
    width: caber(PADRAO.width, area.width),
    height: caber(PADRAO.height, area.height),
    minWidth: caber(MIN_WINDOW.width, area.width),
    minHeight: caber(MIN_WINDOW.height, area.height)
  }
}
