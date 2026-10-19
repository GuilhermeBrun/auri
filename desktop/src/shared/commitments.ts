import { z } from 'zod'
import { isIsoLocalDateTime } from './dates'

export const COMMITMENT_TIPOS = ['palestra', 'curso', 'hospital', 'reuniao', 'reserva'] as const
export type CommitmentTipo = (typeof COMMITMENT_TIPOS)[number]

export const COMMITMENT_LABELS: Record<CommitmentTipo, string> = {
  palestra: 'Palestra',
  curso: 'Curso',
  hospital: 'Hospital',
  reuniao: 'Reunião',
  reserva: 'Reserva'
}

const localDateTime = z.string().refine(isIsoLocalDateTime, 'Data/hora inválida')

export const commitmentInputSchema = z
  .object({
    tipo: z.enum(COMMITMENT_TIPOS),
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
  created_at: string
  updated_at: string
}

export function commitmentName(c: Pick<Commitment, 'tipo' | 'titulo'>): string {
  return c.titulo ? `${COMMITMENT_LABELS[c.tipo]}: ${c.titulo}` : COMMITMENT_LABELS[c.tipo]
}
