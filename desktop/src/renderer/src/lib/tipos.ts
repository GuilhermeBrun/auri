import { useQuery } from '@tanstack/react-query'
import type { Cor, TipoAtendimento } from '@shared/tipos'
import { tiposQuery } from '@renderer/lib/queries'

export function corVar(cor: Cor): string {
  return `var(--color-tipo-${cor})`
}

export function useTipos(atual?: number): {
  tipos: TipoAtendimento[]
  porId: (id: number) => TipoAtendimento | undefined
} {
  const { data = [] } = useQuery(tiposQuery())
  return {
    tipos: data.filter((t) => !t.arquivado || t.id === atual),
    porId: (id) => data.find((t) => t.id === id)
  }
}
