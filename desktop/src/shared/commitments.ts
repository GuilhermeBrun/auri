import { z } from 'zod'
import { isIsoLocalDateTime } from './dates'
import type { Cor } from './tipos'

const localDateTime = z.string().refine(isIsoLocalDateTime, 'Data/hora inválida')

export const commitmentInputSchema = z
  .object({
    etiqueta_id: z.number().int().positive('Escolha a etiqueta'),
    titulo: z.string().trim().max(120, 'Use no máximo 120 caracteres').default(''),
    inicio: localDateTime,
    fim: localDateTime,
    observacao: z.string().trim().max(1000, 'Use no máximo 1000 caracteres').default('')
  })
  .refine((c) => c.fim > c.inicio, {
    message: 'O horário de término deve ser depois do início',
    path: ['fim']
  })

export type CommitmentInput = z.input<typeof commitmentInputSchema>

export type Commitment = z.output<typeof commitmentInputSchema> & {
  id: number
  etiqueta_nome: string
  cor: Cor
  reserva: boolean
  created_at: string
  updated_at: string
}

export function commitmentName(c: Pick<Commitment, 'etiqueta_nome' | 'titulo'>): string {
  return c.titulo ? `${c.etiqueta_nome}: ${c.titulo}` : c.etiqueta_nome
}
