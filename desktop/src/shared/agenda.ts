/** Expediente da agenda: a grade vai das 07:00 às 20:00, e uma sessão tem que caber nela. */
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 20

/** As mesmas horas como aparecem nas mensagens: "07:00" e "20:00". */
export const DAY_START_LABEL = `${String(DAY_START_HOUR).padStart(2, '0')}:00`
export const DAY_END_LABEL = `${String(DAY_END_HOUR).padStart(2, '0')}:00`

const DAY_START_MINUTES = DAY_START_HOUR * 60
const DAY_END_MINUTES = DAY_END_HOUR * 60

/** Horários sugeridos ao marcar uma sessão: de 15 em 15 minutos, da abertura até antes do fim. */
export const TIME_SLOTS: readonly string[] = Array.from(
  { length: (DAY_END_MINUTES - DAY_START_MINUTES) / 15 },
  (_, i) => {
    const minutes = DAY_START_MINUTES + i * 15
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  }
)

/** Minutos desde a meia-noite de um horário "HH:mm". */
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** O horário "HH:mm" existe na grade: das 07:00 até antes das 20:00 (a última linha é o fim). */
export function startsWithinAgenda(time: string): boolean {
  const start = minutesOf(time)
  return start >= DAY_START_MINUTES && start < DAY_END_MINUTES
}

/** Uma sessão que começa em `time` e dura `duration` minutos termina até as 20:00. */
export function endsWithinAgenda(time: string, duration: number): boolean {
  return minutesOf(time) + duration <= DAY_END_MINUTES
}
