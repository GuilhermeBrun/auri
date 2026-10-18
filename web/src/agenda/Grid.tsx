import type { CSSProperties } from 'react'
import {
  clock,
  dateOf,
  FIRST,
  isWeekend,
  LENGTH,
  NOW,
  patientRow,
  range,
  SHORT,
  shortName,
  TODAY,
  VISIBLE,
  weekOf,
  WEEKDAYS,
  type Enter,
  type Session,
  type State,
  type Store
} from './model'

// Conteúdo abaixo do cabeçalho da prévia: agenda (Dia, Semana ou Mês) ou a lista de pacientes.
// Mesmo HTML e classes do CSS da página (style.css).

const vars = (values: Record<string, number>) => values as CSSProperties

/** Horário livre sob o ponteiro: a seleção do app ("10:00 – 10:45"), que o clique agenda. */
export type Slot = { day: number; start: number }

type GridProps = { state: State; store: Store; enter: Enter; ghost: Slot | null }

function Event({
  session,
  state,
  enter,
  index,
  month = false
}: {
  session: Session
  state: State
  enter: Enter
  index: number
  month?: boolean
}) {
  const classes = ['ev']
  if (session.id === state.selected) classes.push('selected')
  if (session.id === state.arrived) classes.push('arrived')
  if (enter === 'all') classes.push('enter')
  if (enter === session.id) classes.push('enter', 'arrived')
  const name = state.mode === 'day' ? session.name : shortName(session.name)
  const title = `${range(session)} · ${session.name}`
  if (month) {
    classes.push('ev-month')
    return (
      <button
        type="button"
        className={classes.join(' ')}
        data-id={session.id}
        title={title}
        style={vars({ '--d': index })}
      >
        <span className="ev-start">{clock(session.start)}</span>
        {name}
      </button>
    )
  }
  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-id={session.id}
      title={title}
      style={vars({ '--top': session.start - FIRST, '--len': session.len, '--d': index })}
    >
      <span className="ev-name">{name}</span>
      <span className="ev-time">{range(session)}</span>
    </button>
  )
}

function WeekGrid({ state, store, enter, ghost }: GridProps) {
  const days =
    state.mode === 'day'
      ? [state.focus]
      : Array.from({ length: 7 }, (_, i) => weekOf(state.focus) * 7 + i)
  let index = 0
  return (
    <div className="cal-week" style={vars({ '--cols': days.length })}>
      <div className="cal-head">
        <span className="gutter" />
        {days.map((day) => {
          const date = dateOf(day)
          const label =
            state.mode === 'day'
              ? 'Ver a semana'
              : `Ver ${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()}`
          return (
            <button
              key={day}
              type="button"
              className={`dh${day === TODAY ? ' today' : ''}`}
              data-day={day}
              aria-label={label}
            >
              <span className="dh-wd">{SHORT[date.getUTCDay()]}</span>
              <span className="dh-num">{date.getUTCDate()}</span>
            </button>
          )
        })}
      </div>
      <div className="cal-body">
        <div className="cal-hours" aria-hidden="true">
          {Array.from({ length: VISIBLE }, (_, i) => (
            <div key={i} className="hour">
              <span>{clock(FIRST + i)}</span>
            </div>
          ))}
        </div>
        <div className="cal-cols">
          {days.map((day) => (
            <div
              key={day}
              className={`col${isWeekend(day) && state.mode !== 'day' ? ' weekend' : ''}`}
              data-day={day}
            >
              {store.day(day).map((session) => (
                <Event
                  key={session.id}
                  session={session}
                  state={state}
                  enter={enter}
                  index={index++}
                />
              ))}
              {day === TODAY && <div className="now" style={vars({ '--top': NOW - FIRST })} />}
              {ghost?.day === day && (
                <div
                  className="ghost"
                  aria-hidden="true"
                  style={vars({ '--top': ghost.start - FIRST })}
                >
                  {range({ start: ghost.start, len: LENGTH })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ state, store, enter }: GridProps) {
  const date = dateOf(state.focus)
  const first = state.focus - (date.getUTCDate() - 1)
  const start = first - dateOf(first).getUTCDay()
  const month = date.getUTCMonth()
  const cells: number[] = []
  for (let day = start; cells.length < 42; day++) {
    if (cells.length % 7 === 0 && cells.length > 0 && dateOf(day).getUTCMonth() !== month) break
    cells.push(day)
  }
  let index = 0
  return (
    <div className="cal-month" style={vars({ '--rows': cells.length / 7 })}>
      <div className="month-head">
        {SHORT.map((label) => (
          <span key={label}>{label.toLowerCase()}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((day) => {
          const current = dateOf(day)
          const sessions = store.day(day)
          const shown = sessions.slice(0, 2)
          const more = sessions.length - shown.length
          const off = current.getUTCMonth() !== month
          return (
            <div
              key={day}
              className={`mc${off ? ' off' : ''}${isWeekend(day) ? ' weekend' : ''}`}
              data-day={day}
            >
              <button
                type="button"
                className={`mc-num${day === TODAY ? ' today' : ''}`}
                data-day={day}
                aria-label={`Ver ${WEEKDAYS[current.getUTCDay()]}, ${current.getUTCDate()}`}
              >
                {current.getUTCDate()}
              </button>
              {shown.map((session) => (
                <Event
                  key={session.id}
                  session={session}
                  state={state}
                  enter={enter}
                  index={index++}
                  month
                />
              ))}
              {more > 0 && (
                <button type="button" className="more" data-day={day}>
                  {`+${more} mais`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PatientsTable({ store, enter }: { store: Store; enter: Enter }) {
  return (
    <div className="pt">
      <div className="pt-head">
        <span>Paciente</span>
        <span>Mãe</span>
        <span>Escola</span>
        <span>Entrada</span>
      </div>
      {store.patients().map((name, index) => {
        const row = patientRow(name)
        return (
          <div
            key={name}
            className={`pt-row${enter === 'all' ? ' enter' : ''}`}
            style={vars({ '--d': index })}
          >
            <span className="pt-cell pt-main">
              <span className="avatar">{row.initials}</span>
              <span className="two">
                <b>{name}</b>
                <span>{row.age}</span>
              </span>
            </span>
            <span className="pt-cell two">
              <span>{row.mother}</span>
              <span>{row.phone}</span>
            </span>
            <span className="pt-cell two">
              <span>{row.school}</span>
              <span>{row.grade}</span>
            </span>
            <span className="pt-cell pt-date">{row.since}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Grid(props: GridProps) {
  if (props.state.view === 'patients')
    return <PatientsTable store={props.store} enter={props.enter} />
  return props.state.mode === 'month' ? <MonthGrid {...props} /> : <WeekGrid {...props} />
}
