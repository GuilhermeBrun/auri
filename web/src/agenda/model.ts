const BASE = Date.UTC(2026, 9, 18)
export const TODAY = 3
export const NOW = 10.2
export const FIRST = 7
export const VISIBLE = 8
export const DAY_END = 20
export const LENGTH = 0.75

export const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]
export const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado'
]
export const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type Kind = 'sessao' | 'avaliacao' | 'exame' | 'reuniao'
export type Mark = 'signed' | 'confirmed' | 'waiting'
export const KINDS: Record<Kind, string> = {
  sessao: 'Sessão',
  avaliacao: 'Avaliação',
  exame: 'Exame',
  reuniao: 'Reunião'
}
export const isBlock = (kind: Kind) => kind === 'reuniao'

const SESSIONS: [number, number, number, string, Kind, Mark?][] = [
  [1, 8, 45, 'Ana Beatriz Souza', 'sessao', 'signed'],
  [1, 9, 45, 'Pedro Souza Lima', 'sessao', 'signed'],
  [1, 11, 60, 'Helena Prado Reis', 'avaliacao', 'signed'],
  [2, 8.5, 45, 'Miguel Rocha Alves', 'sessao', 'signed'],
  [2, 10, 45, 'Laura Dias Melo', 'sessao', 'signed'],
  [2, 11.5, 45, 'Davi Lima Costa', 'sessao', 'signed'],
  [3, 8, 45, 'Sofia Alves Nunes', 'sessao', 'signed'],
  [3, 9, 45, 'Theo Martins Cruz', 'sessao', 'signed'],
  [3, 11.5, 45, 'Lucas Nunes Pires', 'sessao', 'confirmed'],
  [4, 9.5, 45, 'Beatriz Melo Dias', 'sessao', 'waiting'],
  [4, 11, 45, 'Gabriel Reis Prado', 'sessao', 'confirmed'],
  [5, 8, 60, 'Manuela Cruz Rocha', 'exame'],
  [5, 10, 45, 'Rafael Pires Souza', 'sessao'],
  [5, 12, 45, 'Júlia Fontes Lima', 'sessao'],
  [4, 13, 60, 'Equipe', 'reuniao'],
  [3, 10.5, 45, 'Alice Costa Martins', 'sessao', 'confirmed']
]
export const NAMES = [
  'Maria Eduarda',
  'Mike',
  'Jade',
  'Lívia Teixeira Gomes',
  'Arthur Moraes Pinto',
  'Valentina Rocha Lopes',
  'Benício Alves Torres',
  'Isadora Pinto Ramos',
  'Samuel Freitas Lima',
  'Lorena Duarte Campos'
]
export const ARRIVED = SESSIONS.length - 1

const MOTHERS = ['Mariana', 'Carla', 'Fernanda', 'Patrícia', 'Juliana', 'Renata', 'Camila', 'Aline']
const SCHOOLS = [
  ['Colégio Santa Clara', '2º ano'],
  ['Escola Monteiro Lobato', '1º ano'],
  ['Colégio Pequeno Príncipe', '3º ano'],
  ['Escola Estadual Elo', 'Pré II']
]

export type Session = {
  id: number
  day: number
  start: number
  len: number
  name: string
  kind: Kind
  mark?: Mark
}
export type Mode = 'day' | 'week' | 'month'
export type View = 'agenda' | 'patients'
export type State = {
  view: View
  mode: Mode
  focus: number
  selected: number | null
  arrived: number | null
}
export type Enter = 'all' | number | undefined

export const dateOf = (day: number) => new Date(BASE + day * 86400000)
export const weekOf = (day: number) => Math.floor(day / 7)
export const shortName = (name: string) => name.split(' ').slice(0, 2).join(' ')
export const clock = (hours: number) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`
export const range = ({ start, len }: { start: number; len: number }) =>
  `${clock(start)} – ${clock(start + len)}`
export const overlaps = (session: Session, start: number, length: number) =>
  start < session.start + session.len && start + length > session.start
export const closesAt = (day: number) =>
  [FIRST, DAY_END, DAY_END, DAY_END, DAY_END, DAY_END, 12][dateOf(day).getUTCDay()]
export const isClosed = (day: number) => closesAt(day) === FIRST

export function longDay(day: number) {
  const date = dateOf(day)
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`
}

export function shortDate(day: number) {
  const date = dateOf(day)
  return `${SHORT[date.getUTCDay()].toLowerCase()}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()].slice(0, 3)}`
}

export type Store = ReturnType<typeof createStore>

export function createStore() {
  let nextId = SESSIONS.length
  const weeks = new Map<number, Session[]>([
    [
      0,
      SESSIONS.map(([weekday, start, minutes, name, kind, mark], id) => ({
        id,
        day: weekday,
        start,
        len: minutes / 60,
        name,
        kind,
        mark
      }))
    ]
  ])
  function generate(week: number) {
    let seed = (week * 7919 + 104729) >>> 0
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pool = [
      ...SESSIONS.filter((session) => !isBlock(session[4])).map((session) => session[3]),
      ...NAMES
    ]
    const sessions: Session[] = []
    for (let weekday = 1; weekday <= 5; weekday++) {
      const day = week * 7 + weekday
      const count = 2 + Math.floor(random() * 3)
      const starts = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 14, 15].sort(() => random() - 0.5)
      for (const start of starts) {
        if (sessions.filter((session) => session.day === day).length >= count) break
        const pick = random()
        const kind: Kind = pick < 0.12 ? 'avaliacao' : pick < 0.2 ? 'exame' : 'sessao'
        const len = kind === 'sessao' ? LENGTH : 1
        if (sessions.some((session) => session.day === day && overlaps(session, start, len)))
          continue
        const name = pool[Math.floor(random() * pool.length)]
        if (sessions.some((session) => session.day === day && session.name === name)) continue
        const mark: Mark | undefined =
          day < TODAY ? 'signed' : day === TODAY + 1 && random() < 0.7 ? 'confirmed' : undefined
        sessions.push({ id: nextId++, day, start, len, name, kind, mark })
      }
    }
    return sessions
  }
  const week = (number: number) => {
    if (!weeks.has(number)) weeks.set(number, generate(number))
    return weeks.get(number)!
  }
  return {
    day: (day: number) =>
      week(weekOf(day))
        .filter((session) => session.day === day)
        .sort((a, b) => a.start - b.start),
    add(day: number, start: number, name: string) {
      const session: Session = { id: nextId++, day, start, len: LENGTH, name, kind: 'sessao' }
      week(weekOf(day)).push(session)
      return session
    },
    move(id: number, day: number, start: number, mark?: Mark) {
      for (const sessions of weeks.values()) {
        const index = sessions.findIndex((session) => session.id === id)
        if (index < 0) continue
        const [session] = sessions.splice(index, 1)
        const moved = { ...session, day, start, mark }
        week(weekOf(day)).push(moved)
        return moved
      }
      return null
    },
    remove(id: number) {
      for (const sessions of weeks.values()) {
        const index = sessions.findIndex((session) => session.id === id)
        if (index >= 0) return sessions.splice(index, 1)[0]
      }
      return null
    },
    find(id: number) {
      for (const sessions of weeks.values()) {
        const found = sessions.find((session) => session.id === id)
        if (found) return found
      }
      return null
    },
    patients() {
      const names = new Set([
        ...SESSIONS.filter((session) => !isBlock(session[4])).map((session) => session[3]),
        ...NAMES
      ])
      for (const sessions of weeks.values())
        for (const session of sessions) if (!isBlock(session.kind)) names.add(session.name)
      return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }
  }
}

export const initialState = (): State => ({
  view: 'agenda',
  mode: 'week',
  focus: TODAY,
  selected: null,
  arrived: ARRIVED
})

export function period(state: State) {
  const date = dateOf(state.focus)
  if (state.mode === 'month') return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  if (state.mode === 'day') return longDay(state.focus)
  const start = dateOf(weekOf(state.focus) * 7 + 1)
  const end = dateOf(weekOf(state.focus) * 7 + 6)
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${start.getUTCDate()} a ${end.getUTCDate()} de ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`
    : `${start.getUTCDate()} de ${MONTHS[start.getUTCMonth()].slice(0, 3)} a ${end.getUTCDate()} de ${MONTHS[end.getUTCMonth()].slice(0, 3)} ${end.getUTCFullYear()}`
}

export function patientRow(name: string) {
  const parts = name.split(' ')
  const last = parts[parts.length - 1]
  let seed = 0
  for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i)
  const [school, grade] = SCHOOLS[seed % SCHOOLS.length]
  return {
    initials: (parts[0][0] + last[0]).toUpperCase(),
    age: `${5 + (seed % 6)} anos e ${1 + (seed % 11)} ${seed % 11 === 0 ? 'mês' : 'meses'}`,
    mother: `${MOTHERS[seed % MOTHERS.length]} ${last}`,
    phone: `Mãe · (65) 9${String(8000 + (seed % 2000))}-${String(1000 + ((seed * 7) % 9000))}`,
    school,
    grade,
    since: `${String(1 + (seed % 28)).padStart(2, '0')}/0${1 + (seed % 9)}/2026`
  }
}
