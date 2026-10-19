import { addDays } from 'date-fns'
import { parseIsoDate, toIsoDate, toIsoLocalDateTime } from '../../shared/dates'
import {
  quemCabe,
  sugerirHorarios,
  type AtividadeDoPaciente,
  type Funcionamento,
  type Intervalo,
  type Sugestao
} from '../../shared/encaixe'
import {
  sugestaoPedidoSchema,
  vagaSchema,
  type EncaixeNaVaga,
  type SugestaoPedido,
  type Vaga
} from '../../shared/waitlist'
import type { Db } from './connection'
import { listWaitlist } from './waitlist'

export function readFuncionamento(db: Db): Funcionamento[] {
  return db
    .prepare('SELECT dia_semana, abre, fecha FROM clinic_hours ORDER BY dia_semana, abre')
    .all() as Funcionamento[]
}

export function readAtividades(db: Db, patientIds: number[]): AtividadeDoPaciente[] {
  if (patientIds.length === 0) return []
  return db
    .prepare(
      `SELECT patient_id, atividade, dia_semana, inicio, fim FROM patient_activities
       WHERE patient_id IN (SELECT value FROM json_each(?))`
    )
    .all(JSON.stringify(patientIds)) as AtividadeDoPaciente[]
}

function readOcupados(db: Db, de: string, ate: string, ignorar?: number): Intervalo[] {
  return db
    .prepare(
      `SELECT inicio, fim FROM appointments
       WHERE inicio < @ate AND fim > @de AND id IS NOT @ignorar`
    )
    .all({ de, ate, ignorar: ignorar ?? null }) as Intervalo[]
}

export function suggestSlots(db: Db, input: SugestaoPedido, agora: Date): Sugestao[] {
  const pedido = sugestaoPedidoSchema.parse(input)
  const de = `${pedido.de}T00:00`
  const ate = `${toIsoDate(addDays(parseIsoDate(pedido.ate), 1))}T00:00`
  return sugerirHorarios({
    de: pedido.de,
    ate: pedido.ate,
    duracao: pedido.duracao,
    funcionamento: readFuncionamento(db),
    ocupados: readOcupados(db, de, ate, pedido.ignorar_appointment_id),
    atividades: readAtividades(db, [pedido.patient_id]),
    preferencias: { dias: pedido.dias, periodos: pedido.periodos },
    margem: pedido.margem,
    depoisDe: toIsoLocalDateTime(agora)
  })
}

export function whoFits(db: Db, input: Vaga): EncaixeNaVaga[] {
  const vaga = vagaSchema.parse(input)
  const esperas = listWaitlist(db)
  return quemCabe({
    vaga,
    esperas,
    atividades: readAtividades(
      db,
      esperas.map((e) => e.patient_id)
    ),
    margem: vaga.margem
  })
}
