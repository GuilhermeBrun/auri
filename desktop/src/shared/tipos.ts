import { z } from 'zod'

export const CATEGORIAS_PRINCIPAIS = ['sessao', 'avaliacao', 'exame'] as const
export type Categoria = (typeof CATEGORIAS_PRINCIPAIS)[number]

export const CATEGORIAS = [...CATEGORIAS_PRINCIPAIS, 'compromisso'] as const
export type CategoriaEtiqueta = (typeof CATEGORIAS)[number]

export const CATEGORIA_LABELS: Record<CategoriaEtiqueta, string> = {
  sessao: 'Sessão',
  avaliacao: 'Avaliação',
  exame: 'Exame',
  compromisso: 'Compromisso'
}

export function ehPrincipal(categoria: CategoriaEtiqueta): categoria is Categoria {
  return (CATEGORIAS_PRINCIPAIS as readonly string[]).includes(categoria)
}

export type Cor = string

export const COR_HEX = /^#[0-9a-f]{6}$/i

export const corSchema = z
  .string()
  .trim()
  .regex(COR_HEX, 'Escolha uma cor válida')
  .transform((cor) => cor.toLowerCase())

export const CORES_PRONTAS = [
  { cor: '#e11d48', nome: 'Vermelho' },
  { cor: '#ea580c', nome: 'Laranja' },
  { cor: '#d97706', nome: 'Âmbar' },
  { cor: '#eab308', nome: 'Amarelo' },
  { cor: '#16a34a', nome: 'Verde' },
  { cor: '#0d9488', nome: 'Verde-água' },
  { cor: '#0ea5e9', nome: 'Céu' },
  { cor: '#2563eb', nome: 'Azul' },
  { cor: '#4f46e5', nome: 'Índigo' },
  { cor: '#7c3aed', nome: 'Violeta' },
  { cor: '#db2777', nome: 'Rosa' },
  { cor: '#6b7280', nome: 'Grafite' }
] as const

export const COR_ANTIGA: Record<string, string> = {
  grafite: '#6b7280',
  ardosia: '#0ea5e9',
  azul: '#2563eb',
  violeta: '#7c3aed',
  rosa: '#db2777',
  areia: '#d97706'
}

export const COR_PADRAO: Record<CategoriaEtiqueta, string> = {
  sessao: '#6b7280',
  avaliacao: '#2563eb',
  exame: '#7c3aed',
  compromisso: '#0d9488'
}

export const DURACOES = [15, 30, 45, 60, 75, 90, 120] as const

export const SISTEMAS = ['reserva'] as const
export type Sistema = (typeof SISTEMAS)[number]

const nome = (max: number, vazio: string): z.ZodString =>
  z.string().trim().min(1, vazio).max(max, `Use no máximo ${max} caracteres`)

export const duracaoEtiquetaSchema = z
  .number()
  .int()
  .min(15, 'Use pelo menos 15 minutos')
  .max(240, 'Use no máximo 240 minutos')
  .multipleOf(15, 'Use múltiplos de 15 minutos')

export const tipoInputSchema = z.object({
  nome: nome(40, 'Dê um nome à etiqueta'),
  categoria: z.enum(CATEGORIAS),
  cor: corSchema,
  duracao: duracaoEtiquetaSchema
})

export type TipoInput = z.input<typeof tipoInputSchema>

export type TipoAtendimento = z.output<typeof tipoInputSchema> & {
  id: number
  sistema: Sistema | null
}

export type UsoDaEtiqueta = { agendamentos: number; compromissos: number; espera: number }

export function mesmoGrupo(a: CategoriaEtiqueta, b: CategoriaEtiqueta): boolean {
  return ehPrincipal(a) === ehPrincipal(b)
}

export function destinosAoExcluir(
  tipos: readonly TipoAtendimento[],
  tipo: TipoAtendimento
): TipoAtendimento[] {
  return tipos.filter(
    (t) => t.id !== tipo.id && t.sistema === null && mesmoGrupo(t.categoria, tipo.categoria)
  )
}

export function consomePacote(categoria: Categoria): boolean {
  return categoria === 'sessao'
}

export function contaNaFrequencia(categoria: Categoria): boolean {
  return categoria === 'sessao'
}

export function mesmoNome(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
}
