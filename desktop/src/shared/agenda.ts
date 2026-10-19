export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 20

export const DAY_START_LABEL = `${String(DAY_START_HOUR).padStart(2, '0')}:00`
export const DAY_END_LABEL = `${String(DAY_END_HOUR).padStart(2, '0')}:00`

const DAY_START_MINUTES = DAY_START_HOUR * 60
const DAY_END_MINUTES = DAY_END_HOUR * 60

export const TIME_SLOTS: readonly string[] = Array.from(
  { length: (DAY_END_MINUTES - DAY_START_MINUTES) / 15 },
  (_, i) => {
    const minutes = DAY_START_MINUTES + i * 15
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  }
)

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function startsWithinAgenda(time: string): boolean {
  const start = minutesOf(time)
  return start >= DAY_START_MINUTES && start < DAY_END_MINUTES
}

export function endsWithinAgenda(time: string, duration: number): boolean {
  return minutesOf(time) + duration <= DAY_END_MINUTES
}
