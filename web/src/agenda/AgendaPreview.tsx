import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Archive,
  PanelLeftClose,
  Plus,
  Pointer,
  Search,
  Settings,
  Trash,
  Users,
  WindowLogo,
  X
} from '../components/icons'
import { useInView } from '../lib/useInView'
import { moveThumb, prefersReducedMotion, useBrowserLayoutEffect } from '../lib/dom'
import { Grid, type Slot } from './Grid'
import {
  clock,
  createStore,
  dateOf,
  DAY_END,
  FIRST,
  initialState,
  LENGTH,
  longDay,
  NAMES,
  overlaps,
  period,
  range,
  shortDate,
  shortName,
  TODAY,
  VISIBLE,
  type Enter,
  type Mode,
  type State,
  type View
} from './model'

type Toast = { icon: 'check' | 'trash'; title: string; text: string; seq: number }

const INTRO: Omit<Toast, 'seq'> = {
  icon: 'check',
  title: 'Sessão agendada',
  text: 'Alice Costa · qua, 21 de out às 10:30'
}

function Trail({ state }: { state: State }) {
  if (state.view === 'patients') return <b className="crumb-current">Pacientes</b>
  return (
    <>
      <span className="crumb">Agenda</span>
      <span className="crumb-sep" aria-hidden="true">
        /
      </span>
      <b className="crumb-current">{period(state)}</b>
    </>
  )
}

const MODES: [Mode, string][] = [
  ['day', 'Dia'],
  ['week', 'Semana'],
  ['month', 'Mês']
]

function Tools({ state }: { state: State }) {
  if (state.view === 'patients') {
    return (
      <>
        <span className="search">
          <Search />
          <span>Nome, mãe ou CPF</span>
        </span>
        <button type="button" className="ghost-icon" aria-label="Mostrar inativos">
          <Archive />
        </button>
        <button type="button" className="ghost-icon" aria-label="Novo paciente">
          <Plus />
        </button>
      </>
    )
  }
  return (
    <>
      <span className="track">
        <button type="button" className="icon-sm" data-step="-1" aria-label="Anterior">
          <ChevronLeft />
        </button>
        <button type="button" className="today-btn" data-today="">
          Hoje
        </button>
        <button type="button" className="icon-sm" data-step="1" aria-label="Próximo">
          <ChevronRight />
        </button>
      </span>
      <span className="track seg" data-modes="">
        <span className="thumb" aria-hidden="true" />
        {MODES.map(([value, label]) => (
          <button key={value} type="button" data-mode={value} aria-pressed={state.mode === value}>
            {label}
          </button>
        ))}
      </span>
      <button type="button" className="ghost-icon" data-new="" aria-label="Novo agendamento">
        <Plus />
      </button>
    </>
  )
}

function NavButton({
  view,
  current,
  children
}: {
  view: View
  current: View
  children: ReactNode
}) {
  return (
    <button type="button" data-view={view} aria-pressed={view === current}>
      {children}
    </button>
  )
}

export function AgendaPreview() {
  const [shotRef, inView] = useInView<HTMLDivElement>()
  const [store] = useState(createStore)
  const [view, setView] = useState<{ state: State; enter: Enter; key: number }>(() => ({
    state: initialState(),
    enter: undefined,
    key: 0
  }))
  const [pop, setPop] = useState<{ id: number; anchor: HTMLElement } | null>(null)
  const [ghost, setGhost] = useState<Slot | null>(null)
  const [toast, setToast] = useState<Toast>({ ...INTRO, seq: 0 })
  const [ready, setReady] = useState(false)
  const nameIndex = useRef(0)
  const mainRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const { state, enter } = view

  function render(next: State, nextEnter?: Enter) {
    setPop(null)
    setView((current) => ({
      state: { ...next, arrived: typeof nextEnter === 'number' ? nextEnter : null },
      enter: nextEnter,
      key: current.key + 1
    }))
  }

  const showToast = (icon: Toast['icon'], title: string, text: string) =>
    setToast((current) => ({ icon, title, text, seq: current.seq + 1 }))

  useEffect(() => {
    if (!inView) return
    if ((shotRef.current?.clientWidth ?? 0) <= 720) {
      setView((current) => ({
        state: { ...current.state, mode: 'day', arrived: null },
        enter: undefined,
        key: current.key + 1
      }))
    }
    let readyTimer = 0
    const introTimer = window.setTimeout(
      () => {
        setToast((current) => ({ ...INTRO, seq: current.seq + 1 }))
        readyTimer = window.setTimeout(() => setReady(true), 600)
      },
      prefersReducedMotion() ? 0 : 2200
    )
    return () => {
      clearTimeout(introTimer)
      clearTimeout(readyTimer)
    }
  }, [inView, shotRef])

  useBrowserLayoutEffect(() => {
    const modes = toolsRef.current?.querySelector('[data-modes]')
    moveThumb(modes, modes?.querySelector('[aria-pressed="true"]'), false)
  }, [state.mode, state.view, view.key])
  useEffect(() => {
    void document.fonts?.ready.then(() => {
      const modes = toolsRef.current?.querySelector('[data-modes]')
      moveThumb(modes, modes?.querySelector('[aria-pressed="true"]'), false)
    })
  }, [])

  useBrowserLayoutEffect(() => {
    const element = toastRef.current
    if (!element || toast.seq === 0) return
    element.classList.remove('show')
    void element.offsetWidth
    element.classList.add('show')
    const timer = window.setTimeout(() => element.classList.remove('show'), 4000)
    return () => clearTimeout(timer)
  }, [toast.seq])

  useBrowserLayoutEffect(() => {
    const card = popRef.current
    const main = mainRef.current
    if (!pop || !card || !main) return
    const box = main.getBoundingClientRect()
    const target = pop.anchor.getBoundingClientRect()
    const gap = 8
    let left = target.right - box.left + gap
    if (left + card.offsetWidth > box.width - gap) {
      left = target.left - box.left - card.offsetWidth - gap
    }
    if (left < gap) left = target.right - box.left - card.offsetWidth - gap
    const top = Math.min(target.top - box.top, box.height - card.offsetHeight - gap)
    card.style.left = `${Math.max(gap, left)}px`
    card.style.top = `${Math.max(gap, top)}px`
    card.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true })
  }, [pop])

  function closePop() {
    setPop(null)
    setView((current) => ({ ...current, state: { ...current.state, selected: null } }))
  }

  function nextName(day: number) {
    const taken = new Set(store.day(day).map((session) => session.name))
    for (let tries = 0; tries < NAMES.length; tries++) {
      const name = NAMES[nameIndex.current++ % NAMES.length]
      if (!taken.has(name)) return name
    }
    return NAMES[0]
  }

  function schedule(next: State, day: number, start: number) {
    const session = store.add(day, start, nextName(day))
    render(next, session.id)
    showToast(
      'check',
      'Sessão agendada',
      `${shortName(session.name)} · ${shortDate(day)} às ${clock(start)}`
    )
  }

  function slotAt(event: MouseEvent | PointerEvent): (Slot & { column: Element }) | null {
    const target = event.target as Element
    const column = target.closest('.col')
    if (!column || target.closest('.ev')) return null
    const box = column.getBoundingClientRect()
    const half = box.height / 16
    const start = Math.min(
      FIRST + Math.floor((event.clientY - box.top) / half) * 0.5,
      DAY_END - LENGTH
    )
    const day = Number((column as HTMLElement).dataset.day)
    const busy = store.day(day).some((session) => overlaps(session, start, LENGTH))
    return busy ? null : { column, day, start }
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    const slot = slotAt(event)
    setGhost((current) =>
      !slot
        ? null
        : current?.day === slot.day && current.start === slot.start
          ? current
          : { day: slot.day, start: slot.start }
    )
  }

  function onClick(event: MouseEvent) {
    const target = event.target as Element
    if (popRef.current?.contains(target)) {
      if (target.closest('[data-close]')) closePop()
      const remove = target.closest<HTMLElement>('[data-delete]')
      if (remove) {
        const session = store.remove(Number(remove.dataset.delete))
        render({ ...state, selected: null })
        if (session) {
          showToast(
            'trash',
            'Agendamento excluído',
            `${shortName(session.name)} · ${shortDate(session.day)}`
          )
        }
      }
      return
    }
    setReady(true)
    const eventButton = target.closest<HTMLElement>('.ev')
    if (eventButton) {
      const id = Number(eventButton.dataset.id)
      if (!store.find(id)) return
      setView((current) => ({ ...current, state: { ...current.state, selected: id } }))
      setPop({ id, anchor: eventButton })
      return
    }
    const day = target.closest<HTMLElement>('[data-day]')
    const step = target.closest<HTMLElement>('[data-step]')
    const mode = target.closest<HTMLElement>('[data-mode]')
    const nav = target.closest<HTMLElement>('[data-view]')
    if (target.closest('[data-today]')) return render({ ...state, focus: TODAY }, 'all')
    if (target.closest('[data-new]')) {
      const sessions = store.day(TODAY)
      for (let start = 10.5; start <= FIRST + VISIBLE - LENGTH; start += 0.5) {
        if (!sessions.some((session) => overlaps(session, start, LENGTH))) {
          const next = {
            ...state,
            focus: TODAY,
            mode: state.mode === 'month' ? 'week' : state.mode
          }
          return schedule(next as State, TODAY, start)
        }
      }
      return
    }
    if (step) {
      const amount = Number(step.dataset.step)
      let focus = state.focus
      if (state.mode === 'day') focus += amount
      else if (state.mode === 'week') focus += amount * 7
      else {
        const date = dateOf(state.focus)
        const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)
        focus = Math.round((next - dateOf(0).getTime()) / 86400000)
      }
      return render({ ...state, focus }, 'all')
    }
    if (mode) return render({ ...state, mode: mode.dataset.mode as Mode }, 'all')
    if (nav) return render({ ...state, view: nav.dataset.view as View }, 'all')
    if (day && (day.matches('.dh, .mc-num, .more') || state.mode === 'month')) {
      if (state.mode === 'day') return render({ ...state, mode: 'week' }, 'all')
      return render({ ...state, mode: 'day', focus: Number(day.dataset.day) }, 'all')
    }
    const slot = slotAt(event)
    if (slot) {
      setGhost(null)
      return schedule(state, slot.day, slot.start)
    }
    if (pop) closePop()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && pop) {
      pop.anchor.focus()
      closePop()
    }
  }

  const session = pop ? store.find(pop.id) : null
  const shotClasses = ['shot', inView && 'in', ready && 'ready'].filter(Boolean).join(' ')

  return (
    <div ref={shotRef} className={shotClasses} data-reveal="" data-agenda="">
      <div className="shot-glow" aria-hidden="true" />
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="win"
        role="group"
        aria-label="Prévia do Auri, com pacientes fictícios"
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <aside className="win-side">
          <div className="win-strip">
            <span className="lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="toggle" aria-hidden="true">
              <PanelLeftClose />
            </span>
            <WindowLogo />
          </div>
          <nav
            className="win-nav"
            aria-label="Principal"
            style={{ '--active': state.view === 'patients' ? 1 : 0 } as CSSProperties}
          >
            <span className="nav-thumb" aria-hidden="true" />
            <NavButton view="agenda" current={state.view}>
              <CalendarDays />
              Agenda
            </NavButton>
            <NavButton view="patients" current={state.view}>
              <Users />
              Pacientes
            </NavButton>
          </nav>
          <span className="win-foot">
            <Settings />
            Configurações
          </span>
        </aside>
        <div ref={mainRef} className="win-main">
          <div className="win-head">
            <div className="trail" data-trail="">
              <Trail state={state} />
            </div>
            <div ref={toolsRef} className="tools" data-tools="">
              <Tools state={state} />
            </div>
          </div>
          <div
            ref={bodyRef}
            className="win-body"
            data-body=""
            onPointerMove={onPointerMove}
            onPointerLeave={() => setGhost(null)}
          >
            <Grid key={view.key} state={state} store={store} enter={enter} ghost={ghost} />
          </div>
          <div ref={popRef} className="pop" data-pop="" hidden={!session}>
            {session && (
              <>
                <b>{session.name}</b>
                <span>{longDay(session.day)}</span>
                <span>{`${range(session)} · ${Math.round(session.len * 60)} min`}</span>
                <div className="pop-actions">
                  <button type="button" className="pop-danger" data-delete={session.id}>
                    <Trash />
                    Excluir
                  </button>
                  <button type="button" data-close="">
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div ref={toastRef} className="toast" data-toast="" role="status">
          <span className="toast-icon" data-toast-icon="">
            {toast.icon === 'check' ? <Check /> : <Trash />}
          </span>
          <span className="toast-text">
            <b data-toast-title="">{toast.title}</b>
            <span data-toast-text="">{toast.text}</span>
          </span>
          <span className="toast-close" aria-hidden="true">
            <X />
          </span>
        </div>
      </div>
      <p className="shot-hint">
        <Pointer />
        <span>Experimente: clique num horário livre para agendar.</span>
      </p>
    </div>
  )
}
