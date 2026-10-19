import { commitmentName, type CommitmentTipo } from '../../shared/commitments'
import { formatTime, parseIsoLocalDateTime } from '../../shared/dates'
import type { Intervalo } from '../../shared/encaixe'
import type { Db } from './connection'

type Ignore = { appointment?: number | null; commitment?: number | null }

type BusyRow = Intervalo & {
  patient_nome: string | null
  tipo: CommitmentTipo | null
  titulo: string | null
}

export function busyIn(db: Db, de: string, ate: string, ignore: Ignore = {}): BusyRow[] {
  return db
    .prepare(
      `SELECT a.inicio, a.fim, p.nome AS patient_nome, NULL AS tipo, NULL AS titulo
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.inicio < @ate AND a.fim > @de AND a.id IS NOT @appointment
         AND a.presenca IS NOT 'desmarcou'
       UNION ALL
       SELECT c.inicio, c.fim, NULL, c.tipo, c.titulo
       FROM commitments c
       WHERE c.inicio < @ate AND c.fim > @de AND c.id IS NOT @commitment
       ORDER BY 1, 3`
    )
    .all({
      de,
      ate,
      appointment: ignore.appointment ?? null,
      commitment: ignore.commitment ?? null
    }) as BusyRow[]
}

export function assertAgendaFree(db: Db, slot: Intervalo, ignore: Ignore = {}): void {
  const busy = busyIn(db, slot.inicio, slot.fim, ignore)
  if (busy.length === 0) return
  const [first, ...others] = busy
  const time = (value: string): string => formatTime(parseIsoLocalDateTime(value))
  const hours = `das ${time(first.inicio)} às ${time(first.fim)}`
  const [one, many] = others.every((o) => o.patient_nome !== null)
    ? ['sessão', 'sessões']
    : ['horário', 'horários']
  const more =
    others.length === 0 ? '' : ` e mais ${others.length} ${others.length === 1 ? one : many}`
  if (first.patient_nome !== null) {
    throw new Error(`Esse horário já está ocupado: ${first.patient_nome}, ${hours}${more}.`)
  }
  const name = commitmentName({ tipo: first.tipo!, titulo: first.titulo ?? '' })
  throw new Error(`Esse horário está bloqueado: ${name}, ${hours}${more}.`)
}
