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

/** "2026-10-07" → "07/10/2026" (como o campo de data mostra); '' se não for uma data válida. */
export function isoToBrDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  return m && isIsoDate(iso) ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** "07/10/2026" → "2026-10-07"; '' se estiver incompleta ou o dia não existir (30/02). */
export function brDateToIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : ''
  return isIsoDate(iso) ? iso : ''
}

/**
 * Máscara progressiva do campo de data: só dígitos, com as barras postas sozinhas
 * ("07102026" → "07/10/2026"). Quem digita as barras também é atendido: "7/10/2026" vira
 * "07/10/2026".
 */
export function maskBrDate(value: string): string {
  const padded = value.replace(/^(\d)\D/, '0$1/').replace(/^(\d{2}\D)(\d)\D/, '$10$2/')
  const d = padded.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/**
 * Máscara progressiva do campo de hora ("0930" → "09:30"). Um primeiro dígito que não pode ser
 * de dezena de hora ("9") já ganha o zero, e "9:30" vira "09:30".
 */
export function maskTime(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d !== '' && (+d[0] > 2 || /^\d\D/.test(value))) d = `0${d}`
  d = d.slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

/** Completa o que foi digitado ("9" → "09:00", "093" → "09:30"); null se não for um horário. */
export function normalizeTime(text: string): string | null {
  const d = text.replace(/\D/g, '')
  if (d === '' || d.length > 4) return null
  const hours = d.length <= 2 ? d.padStart(2, '0') : d.slice(0, 2)
  const minutes = d.length <= 2 ? '00' : d.slice(2).padEnd(2, '0')
  return +hours < 24 && +minutes < 60 ? `${hours}:${minutes}` : null
}
