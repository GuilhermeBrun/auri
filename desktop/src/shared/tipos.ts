import { z } from 'zod'

export const CATEGORIAS = ['sessao', 'avaliacao', 'exame'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const CATEGORIA_LABELS: Record<Categoria, string> = {
  sessao: 'Sessão',
  avaliacao: 'Avaliação',
  exame: 'Exame'
}

export const CORES = ['grafite', 'azul', 'violeta', 'rosa', 'ambar', 'terracota'] as const
export type Cor = (typeof CORES)[number]

export const COR_LABELS: Record<Cor, string> = {
  grafite: 'Grafite',
  azul: 'Azul',
  violeta: 'Violeta',
  rosa: 'Rosa',
  ambar: 'Âmbar',
  terracota: 'Terracota'
}

export const DURACOES = [15, 30, 45, 60, 75, 90, 120] as const

const nome = (max: number, vazio: string): z.ZodString =>
  z.string().trim().min(1, vazio).max(max, `Use no máximo ${max} caracteres`)

export const tipoInputSchema = z.object({
  nome: nome(40, 'Dê um nome ao tipo'),
  categoria: z.enum(CATEGORIAS),
  cor: z.enum(CORES),
  duracao: z
    .number()
    .int()
    .min(15, 'Use pelo menos 15 minutos')
    .max(240, 'Use no máximo 240 minutos')
    .multipleOf(15, 'Use múltiplos de 15 minutos')
})

export type TipoInput = z.infer<typeof tipoInputSchema>

export type TipoAtendimento = TipoInput & { id: number; arquivado: boolean }

export const etiquetaInputSchema = z.object({
  nome: nome(30, 'Dê um nome à etiqueta'),
  cor: z.enum(CORES)
})

export type EtiquetaInput = z.infer<typeof etiquetaInputSchema>

export type Etiqueta = EtiquetaInput & { id: number; arquivado: boolean }

export type EtiquetaResumo = Pick<Etiqueta, 'id' | 'nome' | 'cor'>

export function consomePacote(categoria: Categoria): boolean {
  return categoria === 'sessao'
}

export function mesmoNome(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
}
