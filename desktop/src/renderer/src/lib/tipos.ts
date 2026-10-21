import { useQuery } from '@tanstack/react-query'
import { ehPrincipal, type CategoriaEtiqueta, type Cor, type TipoAtendimento } from '@shared/tipos'
import { tiposQuery } from '@renderer/lib/queries'

export function corVar(cor: Cor): string {
  return cor
}

export function useTipos(): {
  tipos: TipoAtendimento[]
  porId: (id: number) => TipoAtendimento | undefined
} {
  const { data = [] } = useQuery(tiposQuery())
  return {
    tipos: data.filter((t) => ehPrincipal(t.categoria)),
    porId: (id) => data.find((t) => t.id === id)
  }
}

export function useEtiquetas(categoria: CategoriaEtiqueta): TipoAtendimento[] {
  const { data = [] } = useQuery(tiposQuery())
  return data.filter((t) => t.categoria === categoria)
}
