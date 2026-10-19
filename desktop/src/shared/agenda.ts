import { parseIsoLocalDateTime } from './dates'

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Horario = { abre: string; fecha: string }

export type Funcionamento = Partial<Record<DiaSemana, Horario>>

export const DIAS_SEMANA: readonly DiaSemana[] = [0, 1, 2, 3, 4, 5, 6]

export const DIAS_DA_SEMANA_NOMES: Record<DiaSemana, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
}

const NO_DIA: Record<DiaSemana, string> = {
  0: 'no domingo',
  1: 'na segunda',
  2: 'na terça',
  3: 'na quarta',
  4: 'na quinta',
  5: 'na sexta',
  6: 'no sábado'
}

const SEMANA: Horario = { abre: '07:00', fecha: '20:00' }

export const FUNCIONAMENTO_PADRAO: Funcionamento = {
  1: SEMANA,
  2: SEMANA,
  3: SEMANA,
  4: SEMANA,
  5: SEMANA,
  6: { abre: '07:00', fecha: '12:00' }
}

export const SLOT_MINUTES = 15

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function horarioDoDia(funcionamento: Funcionamento, date: Date): Horario | undefined {
  return funcionamento[date.getDay() as DiaSemana]
}

export function diaAberto(funcionamento: Funcionamento, date: Date): boolean {
  return horarioDoDia(funcionamento, date) !== undefined
}

export function algumDiaAberto(funcionamento: Funcionamento): boolean {
  return DIAS_SEMANA.some((dia) => funcionamento[dia] !== undefined)
}

function minutesOfDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function abertoNoHorario(funcionamento: Funcionamento, date: Date): boolean {
  const horario = horarioDoDia(funcionamento, date)
  if (!horario) return false
  const minutes = minutesOfDate(date)
  return minutes >= minutesOf(horario.abre) && minutes < minutesOf(horario.fecha)
}

export function dentroDoFuncionamento(
  funcionamento: Funcionamento,
  inicio: Date,
  fim: Date
): boolean {
  return foraDoFuncionamento(funcionamento, inicio, fim) === null
}

export function foraDoFuncionamento(
  funcionamento: Funcionamento,
  inicio: Date,
  fim: Date
): string | null {
  const dia = inicio.getDay() as DiaSemana
  const horario = funcionamento[dia]
  if (!horario) return `A clínica não abre ${NO_DIA[dia]}.`
  const sameDay = fim.toDateString() === inicio.toDateString()
  const start = minutesOfDate(inicio)
  const end = sameDay ? minutesOfDate(fim) : 24 * 60
  if (start < minutesOf(horario.abre) || end > minutesOf(horario.fecha)) {
    return `Fora do horário de funcionamento: ${NO_DIA[dia]}, a clínica abre das ${horario.abre} às ${horario.fecha}.`
  }
  return null
}

export function foraDoFuncionamentoIso(
  funcionamento: Funcionamento,
  inicio: string,
  fim: string
): string | null {
  return foraDoFuncionamento(
    funcionamento,
    parseIsoLocalDateTime(inicio),
    parseIsoLocalDateTime(fim)
  )
}

export function horarios(abre: string, fecha: string, step = SLOT_MINUTES): string[] {
  const start = minutesOf(abre)
  const end = minutesOf(fecha)
  const slots: string[] = []
  for (let minutes = start; minutes < end; minutes += step) slots.push(timeOf(minutes))
  return slots
}

export function limitesDoFuncionamento(
  funcionamento: Funcionamento,
  dias: readonly DiaSemana[] = DIAS_SEMANA
): { abre: number; fecha: number } | null {
  const abertos = dias.flatMap((dia) => funcionamento[dia] ?? [])
  if (abertos.length === 0) return null
  return {
    abre: Math.min(...abertos.map((h) => minutesOf(h.abre))),
    fecha: Math.max(...abertos.map((h) => minutesOf(h.fecha)))
  }
}

export function horariosDoDia(funcionamento: Funcionamento, date: Date): string[] {
  const horario = horarioDoDia(funcionamento, date)
  if (horario) return horarios(horario.abre, horario.fecha)
  const limites = limitesDoFuncionamento(funcionamento)
  return limites ? horarios(timeOf(limites.abre), timeOf(limites.fecha)) : []
}

const ABREVIADO: Record<DiaSemana, string> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sáb'
}

export function resumoFuncionamento(funcionamento: Funcionamento): string {
  const ordem: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0]
  const grupos: { dias: DiaSemana[]; horario: Horario }[] = []
  for (const dia of ordem) {
    const horario = funcionamento[dia]
    if (!horario) continue
    const last = grupos.at(-1)
    const anterior = last?.dias.at(-1)
    const seguido = anterior !== undefined && ordem.indexOf(anterior) === ordem.indexOf(dia) - 1
    if (
      last &&
      seguido &&
      last.horario.abre === horario.abre &&
      last.horario.fecha === horario.fecha
    ) {
      last.dias.push(dia)
    } else {
      grupos.push({ dias: [dia], horario })
    }
  }
  if (grupos.length === 0) return 'Fechada todos os dias'
  return grupos
    .map(({ dias, horario }) => {
      const nome =
        dias.length === 1
          ? ABREVIADO[dias[0]]
          : `${ABREVIADO[dias[0]]} a ${ABREVIADO[dias.at(-1)!]}`
      return `${nome} ${horario.abre}–${horario.fecha}`
    })
    .join(', ')
}

export type Confirmacao = 'pendente' | 'confirmado'

export const CONFIRMACAO_LABELS: Record<Confirmacao, string> = {
  pendente: 'Não confirmado',
  confirmado: 'Confirmado'
}

export function confirmacao(appointment: { confirmado_em: string | null }): Confirmacao {
  return appointment.confirmado_em === null ? 'pendente' : 'confirmado'
}
