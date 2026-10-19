import { differenceInDays, differenceInMonths, differenceInYears, format, isValid } from 'date-fns'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

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

export function isIsoDate(value: string): boolean {
  return isValid(parseIsoDate(value))
}

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

export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

export function formatAge(birthDate: string, today: Date = new Date()): string {
  if (!isIsoDate(birthDate)) return ''
  const birth = parseIsoDate(birthDate)
  const days = differenceInDays(today, birth)
  if (days < 0) return ''
  const months = differenceInMonths(today, birth)
  if (months < 1) return plural(days, 'dia', 'dias')
  const years = differenceInYears(today, birth)
  if (years < 1) return plural(months, 'mês', 'meses')
  const rest = months - years * 12
  const anos = plural(years, 'ano', 'anos')
  return rest === 0 ? anos : `${anos} e ${plural(rest, 'mês', 'meses')}`
}

export function isoToBrDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  return m && isIsoDate(iso) ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export function brDateToIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : ''
  return isIsoDate(iso) ? iso : ''
}

export function maskBrDate(value: string): string {
  const padded = value.replace(/^(\d)\D/, '0$1/').replace(/^(\d{2}\D)(\d)\D/, '$10$2/')
  const d = padded.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function maskTime(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d !== '' && (+d[0] > 2 || /^\d\D/.test(value))) d = `0${d}`
  d = d.slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

export function normalizeTime(text: string): string | null {
  const d = text.replace(/\D/g, '')
  if (d === '' || d.length > 4) return null
  const hours = d.length <= 2 ? d.padStart(2, '0') : d.slice(0, 2)
  const minutes = d.length <= 2 ? '00' : d.slice(2).padEnd(2, '0')
  return +hours < 24 && +minutes < 60 ? `${hours}:${minutes}` : null
}
