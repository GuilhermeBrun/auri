// Prévia da agenda do Auri na página de download: a mesma janela do app (barra lateral, cabeçalho,
// grade do react-big-calendar com o CSS de src/renderer/src/assets/main.css), com pacientes
// fictícios. Este módulo só monta HTML, então serve ao gerador da página (Node, primeira pintura) e
// ao navegador (page.js, que redesenha a cada clique).

/** Domingo da semana mostrada primeiro: a agenda do app começa a semana no domingo. */
const BASE = Date.UTC(2026, 9, 18)
/** "Hoje" (quarta-feira, 21 de outubro) e "agora" (10:12), em dias desde BASE e em horas. */
export const TODAY = 3
const NOW = 10.2
/** Horas visíveis na janela da prévia; o expediente do app vai das 7h às 20h e rola. */
export const FIRST = 7
const VISIBLE = 8
export const DAY_END = 20
export const LENGTH = 0.75

const MONTHS = [
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
const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado'
]
const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Semana de 18 a 24 de outubro: dia da semana (1 = segunda), início em horas, duração em minutos.
// A última é a que "acabou de ser agendada" e entra com o destaque.
const SESSIONS = [
  [1, 8, 45, 'Ana Beatriz Souza'],
  [1, 9, 45, 'Pedro Souza Lima'],
  [1, 11, 60, 'Helena Prado Reis'],
  [2, 8.5, 45, 'Miguel Rocha Alves'],
  [2, 10, 45, 'Laura Dias Melo'],
  [2, 11.5, 45, 'Davi Lima Costa'],
  [3, 8, 45, 'Sofia Alves Nunes'],
  [3, 9, 45, 'Theo Martins Cruz'],
  [3, 11.5, 45, 'Lucas Nunes Pires'],
  [4, 9.5, 45, 'Beatriz Melo Dias'],
  [4, 11, 45, 'Gabriel Reis Prado'],
  [5, 8, 60, 'Manuela Cruz Rocha'],
  [5, 10, 45, 'Rafael Pires Souza'],
  [5, 12, 45, 'Júlia Fontes Lima'],
  [3, 10.5, 45, 'Alice Costa Martins']
]
/** Pacientes das sessões criadas na prévia e das outras semanas. */
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

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

/** Ícones Lucide usados no app (mesmos nomes). */
export const ICONS = {
  calendarDays: svg(
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>'
  ),
  users: svg(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  ),
  settings: svg(
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
  ),
  panelLeftClose: svg(
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>'
  ),
  chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  archive: svg(
    '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
  ),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  trash: svg(
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'
  ),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
}

const SYMBOL =
  'M10 51C3 52 0 46 1 37C5 16 29 0 52 0C84 0 105 19 106 47L106 66C106 76 109 80 113 84C123 96 116 110 102 110C90 110 82 103 74 92L63 77C56 67 49 67 41 73C31 80 27 89 31 96C35 103 44 106 48 109C34 114 15 111 7 101C-1 92-2 77 5 66C13 55 27 49 39 49C58 49 68 58 78 70C82 75 85 80 88 77C90 75 89 70 89 64L88 53C87 40 82 32 73 30C61 25 52 31 40 39L20 49C16 51 12 52 10 51Z'
const LOGO = `<svg class="win-logo" viewBox="0 0 268 118" fill="currentColor" aria-hidden="true"><g transform="translate(10 33) scale(0.64)"><path d="${SYMBOL}"/></g><g transform="translate(-118 2)"><path d="M218 38H231C236 38 239 41 239 46V74C239 82 243 87 251 87C260 87 264 81 264 74V46C264 41 267 38 272 38H284V75C284 94 271 103 251 103C231 103 218 94 218 75V38Z"/><path d="M296 38H314V46C320 39 328 36 340 37V55C324 55 315 62 315 75V94C315 99 312 101 307 101H296V38Z"/><path d="M358 38H366C371 38 374 41 374 46V93C374 98 371 101 366 101H358C353 101 350 98 350 93V46C350 41 353 38 358 38Z"/><circle cx="362" cy="22" r="11"/></g></svg>`

const escape = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]
  )
export const dateOf = (day) => new Date(BASE + day * 86400000)
const weekOf = (day) => Math.floor(day / 7)
/** Dois primeiros nomes, como o `shortName` do app (Semana e Mês). */
const shortName = (name) => name.split(' ').slice(0, 2).join(' ')
export const clock = (hours) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`
const range = (session) => `${clock(session.start)} – ${clock(session.start + session.len)}`
export const overlaps = (session, start, length) =>
  start < session.start + session.len && start + length > session.start

/** Data curta dos avisos do app: "qua, 21 de out". */
export function shortDate(day) {
  const date = dateOf(day)
  return `${SHORT[date.getUTCDay()].toLowerCase()}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()].slice(0, 3)}`
}

/**
 * Sessões por semana. A de 18 a 24 de outubro é a fixa; as outras são sorteadas, sempre iguais
 * para a mesma semana. `day` é o número do dia desde BASE (pode ser negativo).
 */
export function createStore() {
  let nextId = SESSIONS.length
  const weeks = new Map([
    [
      0,
      SESSIONS.map(([weekday, start, minutes, name], id) => ({
        id,
        day: weekday,
        start,
        len: minutes / 60,
        name
      }))
    ]
  ])
  function generate(week) {
    let seed = (week * 7919 + 104729) >>> 0
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pool = [...SESSIONS.map((session) => session[3]), ...NAMES]
    const sessions = []
    for (let weekday = 1; weekday <= 5; weekday++) {
      const day = week * 7 + weekday
      const count = 2 + Math.floor(random() * 3)
      const starts = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 14, 15].sort(() => random() - 0.5)
      for (const start of starts) {
        if (sessions.filter((session) => session.day === day).length >= count) break
        const len = random() < 0.25 ? 1 : LENGTH
        if (sessions.some((session) => session.day === day && overlaps(session, start, len)))
          continue
        const name = pool[Math.floor(random() * pool.length)]
        if (sessions.some((session) => session.day === day && session.name === name)) continue
        sessions.push({ id: nextId++, day, start, len, name })
      }
    }
    return sessions
  }
  const week = (number) => {
    if (!weeks.has(number)) weeks.set(number, generate(number))
    return weeks.get(number)
  }
  return {
    week,
    /** Sessões de um dia, em ordem de horário. */
    day: (day) =>
      week(weekOf(day))
        .filter((session) => session.day === day)
        .sort((a, b) => a.start - b.start),
    add(day, start, name) {
      const session = { id: nextId++, day, start, len: LENGTH, name }
      week(weekOf(day)).push(session)
      return session
    },
    remove(id) {
      for (const sessions of weeks.values()) {
        const index = sessions.findIndex((session) => session.id === id)
        if (index >= 0) return sessions.splice(index, 1)[0]
      }
      return null
    },
    find(id) {
      for (const sessions of weeks.values()) {
        const found = sessions.find((session) => session.id === id)
        if (found) return found
      }
      return null
    },
    /** Pacientes conhecidos, com a próxima sessão já vista. */
    patients() {
      const names = new Set([...SESSIONS.map((session) => session[3]), ...NAMES])
      for (const sessions of weeks.values()) for (const session of sessions) names.add(session.name)
      return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }
  }
}

export const initialState = () => ({
  view: 'agenda',
  mode: 'week',
  focus: TODAY,
  selected: null,
  arrived: ARRIVED
})

/** Período no cabeçalho, como o `periodLabel` do app ("18 a 24 de outubro 2026"). */
function period(state) {
  const date = dateOf(state.focus)
  if (state.mode === 'month') return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  if (state.mode === 'day')
    return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`
  const start = dateOf(weekOf(state.focus) * 7)
  const end = dateOf(weekOf(state.focus) * 7 + 6)
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${start.getUTCDate()} a ${end.getUTCDate()} de ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`
    : `${start.getUTCDate()} de ${MONTHS[start.getUTCMonth()].slice(0, 3)} a ${end.getUTCDate()} de ${MONTHS[end.getUTCMonth()].slice(0, 3)} ${end.getUTCFullYear()}`
}

export function trail(state) {
  return state.view === 'patients'
    ? '<b class="crumb-current">Pacientes</b>'
    : `<span class="crumb">Agenda</span><span class="crumb-sep" aria-hidden="true">/</span><b class="crumb-current">${period(state)}</b>`
}

function event(session, state, enter, index, month = false) {
  const classes = ['ev']
  if (session.id === state.selected) classes.push('selected')
  if (session.id === state.arrived) classes.push('arrived')
  if (enter === 'all') classes.push('enter')
  if (enter === session.id) classes.push('enter', 'arrived')
  const name = state.mode === 'day' ? session.name : shortName(session.name)
  if (month) {
    return `<button type="button" class="${classes.join(' ')} ev-month" data-id="${session.id}" title="${range(session)} · ${escape(session.name)}" style="--d:${index}"><span class="ev-start">${clock(session.start)}</span>${escape(name)}</button>`
  }
  return `<button type="button" class="${classes.join(' ')}" data-id="${session.id}" title="${range(session)} · ${escape(session.name)}" style="--top:${session.start - FIRST};--len:${session.len};--d:${index}"><span class="ev-name">${escape(name)}</span><span class="ev-time">${range(session)}</span></button>`
}

function weekGrid(state, store, enter) {
  const days =
    state.mode === 'day'
      ? [state.focus]
      : Array.from({ length: 7 }, (_, i) => weekOf(state.focus) * 7 + i)
  const weekend = (day) => [0, 6].includes(dateOf(day).getUTCDay())
  let index = 0
  const head = days
    .map((day) => {
      const date = dateOf(day)
      const label =
        state.mode === 'day'
          ? 'Ver a semana'
          : `Ver ${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()}`
      return `<button type="button" class="dh${day === TODAY ? ' today' : ''}" data-day="${day}" aria-label="${label}"><span class="dh-wd">${SHORT[date.getUTCDay()]}</span><span class="dh-num">${date.getUTCDate()}</span></button>`
    })
    .join('')
  const columns = days
    .map((day) => {
      const sessions = store
        .day(day)
        .map((session) => event(session, state, enter, index++))
        .join('')
      const now = day === TODAY ? `<div class="now" style="--top:${NOW - FIRST}"></div>` : ''
      return `<div class="col${weekend(day) && state.mode !== 'day' ? ' weekend' : ''}" data-day="${day}">${sessions}${now}</div>`
    })
    .join('')
  const hours = Array.from(
    { length: VISIBLE },
    (_, i) => `<div class="hour"><span>${clock(FIRST + i)}</span></div>`
  ).join('')
  return `<div class="cal-week" style="--cols:${days.length}"><div class="cal-head"><span class="gutter"></span>${head}</div><div class="cal-body"><div class="cal-hours" aria-hidden="true">${hours}</div><div class="cal-cols">${columns}</div></div></div>`
}

function monthGrid(state, store, enter) {
  const date = dateOf(state.focus)
  const first = state.focus - (date.getUTCDate() - 1)
  const start = first - dateOf(first).getUTCDay()
  const month = date.getUTCMonth()
  const cells = []
  let index = 0
  for (let day = start; cells.length < 42; day++) {
    const current = dateOf(day)
    if (cells.length % 7 === 0 && cells.length > 0 && current.getUTCMonth() !== month) break
    const sessions = store.day(day)
    const shown = sessions.slice(0, 2)
    const more = sessions.length - shown.length
    const off = current.getUTCMonth() !== month
    const weekend = [0, 6].includes(current.getUTCDay())
    cells.push(
      `<div class="mc${off ? ' off' : ''}${weekend ? ' weekend' : ''}" data-day="${day}"><button type="button" class="mc-num${day === TODAY ? ' today' : ''}" data-day="${day}" aria-label="Ver ${WEEKDAYS[current.getUTCDay()]}, ${current.getUTCDate()}">${current.getUTCDate()}</button>${shown.map((session) => event(session, state, enter, index++, true)).join('')}${more > 0 ? `<button type="button" class="more" data-day="${day}">+${more} mais</button>` : ''}</div>`
    )
  }
  return `<div class="cal-month" style="--rows:${cells.length / 7}"><div class="month-head">${SHORT.map((label) => `<span>${label.toLowerCase()}</span>`).join('')}</div><div class="month-grid">${cells.join('')}</div></div>`
}

function patientsTable(store, enter) {
  const rows = store
    .patients()
    .map((name, index) => {
      const parts = name.split(' ')
      const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
      const [school, grade] = SCHOOLS[seed % SCHOOLS.length]
      const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return `<div class="pt-row${enter === 'all' ? ' enter' : ''}" style="--d:${index}"><span class="pt-cell pt-main"><span class="avatar">${initials}</span><span class="two"><b>${escape(name)}</b><span>${5 + (seed % 6)} anos</span></span></span><span class="pt-cell two"><span>${MOTHERS[seed % MOTHERS.length]} ${parts[parts.length - 1]}</span><span>(65) 9${String(8000 + (seed % 2000))}-${String(1000 + ((seed * 7) % 9000))}</span></span><span class="pt-cell two"><span>${school}</span><span>${grade}</span></span><span class="pt-cell pt-date">${String(1 + (seed % 28)).padStart(2, '0')}/0${1 + (seed % 9)}/2026</span></div>`
    })
    .join('')
  return `<div class="pt"><div class="pt-head"><span>Paciente</span><span>Mãe</span><span>Escola</span><span>Entrada</span></div>${rows}</div>`
}

/** Conteúdo abaixo do cabeçalho: agenda (Dia, Semana ou Mês) ou a lista de pacientes. */
export function body(state, store, enter) {
  if (state.view === 'patients') return patientsTable(store, enter)
  return state.mode === 'month' ? monthGrid(state, store, enter) : weekGrid(state, store, enter)
}

/** Ferramentas do cabeçalho, como as do app em cada tela. */
export function tools(state) {
  if (state.view === 'patients') {
    return `<span class="search">${ICONS.search}<span>Nome, mãe ou CPF</span></span><button type="button" class="ghost-icon" aria-label="Mostrar inativos">${ICONS.archive}</button><button type="button" class="ghost-icon" aria-label="Novo paciente">${ICONS.plus}</button>`
  }
  const modes = [
    ['day', 'Dia'],
    ['week', 'Semana'],
    ['month', 'Mês']
  ]
  return `<span class="track"><button type="button" class="icon-sm" data-step="-1" aria-label="Anterior">${ICONS.chevronLeft}</button><button type="button" class="today-btn" data-today>Hoje</button><button type="button" class="icon-sm" data-step="1" aria-label="Próximo">${ICONS.chevronRight}</button></span><span class="track seg" data-modes><span class="thumb" aria-hidden="true"></span>${modes.map(([value, label]) => `<button type="button" data-mode="${value}" aria-pressed="${state.mode === value}">${label}</button>`).join('')}</span><button type="button" class="ghost-icon" data-new aria-label="Novo agendamento">${ICONS.plus}</button>`
}

/** A janela inteira, na primeira pintura (o gerador da página a põe no HTML). */
export function windowHtml(state = initialState(), store = createStore()) {
  return `<div class="win" role="group" aria-label="Prévia do Auri, com pacientes fictícios">
<aside class="win-side">
<div class="win-strip"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span><span class="toggle" aria-hidden="true">${ICONS.panelLeftClose}</span>${LOGO}</div>
<nav class="win-nav" aria-label="Principal"><span class="nav-thumb" aria-hidden="true"></span><button type="button" data-view="agenda" aria-pressed="true">${ICONS.calendarDays}Agenda</button><button type="button" data-view="patients" aria-pressed="false">${ICONS.users}Pacientes</button></nav>
<span class="win-foot">${ICONS.settings}Configurações</span>
</aside>
<div class="win-main">
<div class="win-head"><div class="trail" data-trail>${trail(state)}</div><div class="tools" data-tools>${tools(state)}</div></div>
<div class="win-body" data-body>${body(state, store)}</div>
<div class="pop" data-pop hidden></div>
</div>
<div class="toast" data-toast role="status"><span class="toast-icon" data-toast-icon>${ICONS.check}</span><span class="toast-text"><b data-toast-title>Sessão agendada</b><span data-toast-text>Alice Costa · qua, 21 de out às 10:30</span></span><span class="toast-close" aria-hidden="true">${ICONS.x}</span></div>
</div>`
}
