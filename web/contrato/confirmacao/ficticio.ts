import { ID_FICTICIO } from '../assinatura/ficticio'
import type { Confirmacao } from './formato'

export const INICIO_FICTICIO = Math.floor(Date.UTC(2026, 9, 22, 18) / 1000)
export const ENVIO_FICTICIO = Math.floor(Date.UTC(2026, 9, 21, 12, 30) / 1000)

export function confirmacaoFicticia(mudancas: Partial<Confirmacao> = {}): Confirmacao {
  return {
    id: ID_FICTICIO,
    ate: ENVIO_FICTICIO + 2 * 3600,
    tz: -240,
    cli: { nome: 'Clínica Exemplo', whats: '5565999990000' },
    pac: { nome: 'Ana Beatriz' },
    ses: { ini: INICIO_FICTICIO, dur: 50, prof: 'Fernanda' },
    cob: true,
    ...mudancas
  }
}
