import { differenceInDays, differenceInMonths, differenceInYears, format, isValid } from 'date-fns'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Data local a partir dos números; Invalid Date se o dia não existe (30/02) ou a hora passa de
 * 23:59. Feito à mão em vez do `parse` do date-fns, que é genérico e lento: a agenda lê duas datas
 * por sessão a cada período exibido.
 */
function localDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hours, minutes, 0, 0)
  const exists = date.getMonth() === month - 1 && date.getDate() === day
  return exists && hours < 24 && minutes < 60 ? date : new Date(NaN)
}

export function parseIsoDate(value: string): Date {
  const m = ISO_DATE.exec(value)
  return m ? localDate(+m[1], +m[2], +m[3]) : new Date(NaN)
}

export function parseIsoLocalDateTime(value: string): Date {
  const m = ISO_LOCAL_DATETIME.exec(value)
  return m ? localDate(+m[1], +m[2], +m[3], +m[4], +m[5]) : new Date(NaN)
}

/** Data no formato AAAA-MM-DD (o mesmo do <input type="date">). */
export function isIsoDate(value: string): boolean {
  return isValid(parseIsoDate(value))
}

/** Data e hora locais, sem fuso: AAAA-MM-DDTHH:mm. */
export function isIsoLocalDateTime(value: string): boolean {
  return isValid(parseIsoLocalDateTime(value))
}

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function toIsoLocalDateTime(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Horário "14:30". Também feito à mão: a agenda formata centenas de horários a cada período. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/**
 * Idade como aparece na ficha: dias para recém-nascidos, meses no primeiro ano, depois anos.
 * Retorna '' quando a data é inválida ou está no futuro.
 */
export function formatAge(birthDate: string, today: Date = new Date()): string {
  if (!isIsoDate(birthDate)) return ''
  const birth = parseIsoDate(birthDate)
  const days = differenceInDays(today, birth)
  if (days < 0) return ''
  const months = differenceInMonths(today, birth)
  if (months < 1) return plural(days, 'dia', 'dias')
  const years = differenceInYears(today, birth)
  if (years < 1) return plural(months, 'mês', 'meses')
  return plural(years, 'ano', 'anos')
}
