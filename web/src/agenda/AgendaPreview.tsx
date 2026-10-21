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
  Building,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Archive,
  Ellipsis,
  Hourglass,
  MessageCircle,
  PanelLeftClose,
  Plus,
  Pointer,
  Search,
  Settings,
  Trash,
  Undo,
  Users,
  Wallet,
  WindowLogo,
  X
} from '../components/icons'
import { useInView } from '../lib/useInView'
import { moveThumb, prefersReducedMotion, useBrowserLayoutEffect } from '../lib/dom'
import { Grid, type Drag, type Slot } from './Grid'
import {
  clock,
  closesAt,
  createStore,
  dateOf,
  DAY_END,
  FIRST,
  initialState,
  isBlock,
  isClosed,
  KINDS,
  LENGTH,
  longDay,
  NAMES,
  NOW,
  overlaps,
  period,
  range,
  shortDate,
  shortName,
  TODAY,
  VISIBLE,
  type Enter,
  type Mark,
  type Mode,
  type Session,
  type State,
  type View
} from './model'

type Undo = { id: number; day: number; start: number; mark?: Mark }

type Toast = {
  icon: 'check' | 'trash' | 'alert'
  title: string
  text: string
  seq: number
  undo?: Undo
}

type Gesture = {
  id: number
  pointer: number
  from: { x: number; y: number }
  card: HTMLElement
  grab: { x: number; y: number }
  origin: { x: number; y: number }
  lift: HTMLElement | null
  label: HTMLElement | null
  target: (Drag & { day: number }) | null
  done: AbortController
}

const LIFT_THRESHOLD = 5
const LAND_MS = 180
const SNAP = 0.25

const ON_DAY = [
  'no domingo',
  'na segunda',
  'na terça',
  'na quarta',
  'na quinta',
  'na sexta',
  'no sábado'
]

const isPast = (day: number, start: number) => day < TODAY || (day === TODAY && start <= NOW)

const movable = (session: Session) =>
  isBlock(session.kind) || (session.mark !== 'signed' && !isPast(session.day, session.start))

const span = (start: number, len: number) => `${clock(start)}–${clock(start + len)}`

const describe = (session: Session) =>
  `${isBlock(session.kind) ? `${KINDS[session.kind]}: ${session.name}` : shortName(session.name)} · ${shortDate(session.day)} · ${span(session.start, session.len)}`

const MARK_TEXT = {
  signed: 'Chegada assinada',
  confirmed: 'Presença confirmada pelo WhatsApp',
  waiting: 'Aguardando a resposta da família'
}

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
          <span>Nome, família ou CPF</span>
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
      <span className="tag-filter" aria-hidden="true">
        Todas as etiquetas
        <ChevronDown />
      </span>
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
      <span className="ghost-icon" aria-hidden="true">
        <CalendarCheck />
      </span>
      <span className="ghost-icon" aria-hidden="true">
        <Hourglass />
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
  const [drag, setDrag] = useState<Drag | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const swallowClick = useRef(false)
  const winRef = useRef<HTMLDivElement>(null)
  const liftRef = useRef<HTMLDivElement>(null)
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

  const showToast = (icon: Toast['icon'], title: string, text: string, undo?: Undo) =>
    setToast((current) => ({ icon, title, text, undo, seq: current.seq + 1 }))

  useEffect(() => () => gesture.current?.done.abort(), [])

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
    const timer = window.setTimeout(
      () => element.classList.remove('show'),
      toast.undo ? 6000 : 4000
    )
    return () => clearTimeout(timer)
  }, [toast.seq, toast.undo])

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
    const busy =
      start + LENGTH > closesAt(day) ||
      store.day(day).some((session) => overlaps(session, start, LENGTH))
    return busy ? null : { column, day, start }
  }

  function problem(session: Session, day: number, start: number) {
    if (!isBlock(session.kind) && isPast(day, start)) {
      return { title: 'Não foi possível mover', text: 'Esse horário já passou.' }
    }
    if (isClosed(day)) {
      return {
        title: 'Não foi possível mover',
        text: `A clínica não abre ${ON_DAY[dateOf(day).getUTCDay()]}.`
      }
    }
    if (start + session.len > closesAt(day)) {
      const on = ON_DAY[dateOf(day).getUTCDay()]
      return {
        title: 'Fora do horário de funcionamento',
        text: `${on[0].toUpperCase()}${on.slice(1)}, a clínica abre das ${clock(FIRST)} às ${clock(closesAt(day))}.`
      }
    }
    const busy = store
      .day(day)
      .find((other) => other.id !== session.id && overlaps(other, start, session.len))
    if (busy) {
      return {
        title: isBlock(busy.kind) ? 'Esse horário está bloqueado' : 'Esse horário já está ocupado',
        text: `${isBlock(busy.kind) ? `${KINDS[busy.kind]}: ${busy.name}` : busy.name}, das ${clock(busy.start)} às ${clock(busy.start + busy.len)}.`
      }
    }
    return null
  }

  function placeLift(g: Gesture, x: number, y: number) {
    if (g.lift) g.lift.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  function liftCard(g: Gesture) {
    const main = mainRef.current
    const layer = liftRef.current
    if (!main || !layer) return
    const box = main.getBoundingClientRect()
    const card = g.card.getBoundingClientRect()
    g.grab = { x: g.from.x - card.left, y: g.from.y - card.top }
    g.origin = { x: card.left - box.left, y: card.top - box.top }
    const copy = g.card.cloneNode(true) as HTMLElement
    copy.classList.remove('enter', 'arrived', 'selected', 'origin')
    for (const name of ['title', 'data-id']) copy.removeAttribute(name)
    copy.tabIndex = -1
    const lift = document.createElement('div')
    lift.className = 'lift'
    lift.style.width = `${card.width}px`
    lift.style.height = `${card.height}px`
    const body = document.createElement('div')
    body.className = 'lift-card'
    body.append(copy)
    const label = document.createElement('span')
    label.className = 'lift-time'
    lift.append(body, label)
    layer.append(lift)
    g.lift = lift
    g.label = label
    placeLift(g, g.origin.x, g.origin.y)
    winRef.current?.setAttribute('data-dragging', '')
    setGhost(null)
    setPop(null)
    setView((current) => ({ ...current, state: { ...current.state, selected: null } }))
    setReady(true)
  }

  function aim(g: Gesture, x: number, y: number) {
    const body = bodyRef.current
    const session = store.find(g.id)
    if (!body || !session || !g.label) return
    const hour = body.querySelector('.hour')?.getBoundingClientRect().height ?? 0
    const column = Array.from(body.querySelectorAll<HTMLElement>('.col')).find((col) => {
      const box = col.getBoundingClientRect()
      return x >= box.left && x < box.right
    })
    if (!column || hour <= 0) {
      g.target = null
      g.label.hidden = true
      setDrag({ id: g.id, day: null, start: session.start, refused: false })
      return
    }
    const box = column.getBoundingClientRect()
    const free = FIRST + (y - g.grab.y - box.top) / hour
    const last = FIRST + box.height / hour - session.len
    const start = Math.min(Math.max(Math.round(free / SNAP) * SNAP, FIRST), last)
    const day = Number(column.dataset.day)
    const refused = problem(session, day, start) !== null
    g.label.hidden = false
    g.label.textContent = `${clock(start)} – ${clock(start + session.len)}`
    g.label.classList.toggle('refused', refused)
    if (g.target?.day === day && g.target.start === start) return
    g.target = { id: g.id, day, start, refused }
    setDrag(g.target)
  }

  function land(g: Gesture, to: { x: number; y: number } | null, after: () => void) {
    const lift = g.lift
    const finish = () => {
      lift?.remove()
      winRef.current?.removeAttribute('data-dragging')
      setDrag(null)
      after()
    }
    if (!lift || !to || prefersReducedMotion()) return finish()
    lift.style.transition = `transform ${LAND_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
    placeLift(g, to.x, to.y)
    lift.classList.add('landing')
    window.setTimeout(finish, LAND_MS)
  }

  function drop(g: Gesture) {
    const session = store.find(g.id)
    const target = g.target
    const main = mainRef.current?.getBoundingClientRect()
    if (!session || !main) return land(g, null, () => {})
    if (!target || (target.day === session.day && target.start === session.start)) {
      return land(g, g.origin, () => {})
    }
    const issue = problem(session, target.day, target.start)
    if (issue) {
      return land(g, g.origin, () => showToast('alert', issue.title, issue.text))
    }
    const marker = bodyRef.current?.querySelector('.drop')?.getBoundingClientRect()
    const to = marker ? { x: marker.left - main.left, y: marker.top - main.top } : null
    land(g, to, () => {
      const undo = { id: session.id, day: session.day, start: session.start, mark: session.mark }
      const moved = store.move(session.id, target.day, target.start)
      if (!moved) return
      render({ ...state, selected: null })
      showToast(
        'check',
        isBlock(moved.kind) ? 'Compromisso movido' : 'Sessão remarcada',
        describe(moved),
        undo
      )
    })
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || event.pointerType === 'touch') return
    if (state.view !== 'agenda' || state.mode === 'month' || gesture.current) return
    const card = (event.target as Element).closest<HTMLElement>('.ev')
    const session = card ? store.find(Number(card.dataset.id)) : null
    if (!card || !session || !movable(session)) return
    const done = new AbortController()
    const g: Gesture = {
      id: session.id,
      pointer: event.pointerId,
      from: { x: event.clientX, y: event.clientY },
      card,
      grab: { x: 0, y: 0 },
      origin: { x: 0, y: 0 },
      lift: null,
      label: null,
      target: null,
      done
    }
    gesture.current = g
    const end = (cancel: boolean) => {
      done.abort()
      gesture.current = null
      if (!g.lift) return
      swallowClick.current = true
      window.setTimeout(() => (swallowClick.current = false), 0)
      if (cancel) return land(g, g.origin, () => {})
      drop(g)
    }
    window.addEventListener(
      'pointermove',
      (move) => {
        if (move.pointerId !== g.pointer) return
        if (!g.lift) {
          if (
            Math.abs(move.clientX - g.from.x) <= LIFT_THRESHOLD &&
            Math.abs(move.clientY - g.from.y) <= LIFT_THRESHOLD
          )
            return
          liftCard(g)
        }
        const main = mainRef.current?.getBoundingClientRect()
        if (!main) return
        move.preventDefault()
        placeLift(g, move.clientX - g.grab.x - main.left, move.clientY - g.grab.y - main.top)
        aim(g, move.clientX, move.clientY)
      },
      { signal: done.signal }
    )
    window.addEventListener('pointerup', (up) => up.pointerId === g.pointer && end(false), {
      signal: done.signal
    })
    window.addEventListener('pointercancel', () => end(true), { signal: done.signal })
    window.addEventListener('keydown', (key) => key.key === 'Escape' && end(true), {
      signal: done.signal
    })
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || gesture.current?.lift) return
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
    if (swallowClick.current) return
    if (target.closest('[data-undo]') && toast.undo) {
      const { id, day, start, mark } = toast.undo
      const moved = store.find(id)
      const issue = moved && problem(moved, day, start)
      if (issue) return showToast('alert', issue.title, issue.text)
      const back = store.move(id, day, start, mark)
      if (!back) return
      render({ ...state, selected: null })
      return showToast('check', 'Desfeito', describe(back))
    }
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
        ref={winRef}
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
            <span className="nav-item">
              <Wallet />
              Financeiro
            </span>
            <span className="nav-item">
              <Building />
              Clínica
            </span>
            <span className="nav-item">
              <MessageCircle />
              WhatsApp
            </span>
          </nav>
          <span className="nav-more" aria-hidden="true">
            <Ellipsis />
          </span>
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
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setGhost(null)}
          >
            <Grid
              key={view.key}
              state={state}
              store={store}
              enter={enter}
              ghost={ghost}
              drag={drag}
            />
          </div>
          <div ref={liftRef} className="lift-layer" aria-hidden="true" />
          <div ref={popRef} className="pop" data-pop="" hidden={!session}>
            {session && (
              <>
                <b>{session.name}</b>
                <span>{longDay(session.day)}</span>
                <span>{`${KINDS[session.kind]} · ${range(session)} · ${Math.round(session.len * 60)} min`}</span>
                {session.mark && <span>{MARK_TEXT[session.mark]}</span>}
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
            {toast.icon === 'check' ? (
              <Check />
            ) : toast.icon === 'alert' ? (
              <CircleAlert />
            ) : (
              <Trash />
            )}
          </span>
          <span className="toast-text">
            <b data-toast-title="">{toast.title}</b>
            <span data-toast-text="">{toast.text}</span>
          </span>
          {toast.undo && (
            <button type="button" className="toast-action" data-undo="">
              <Undo />
              Desfazer
            </button>
          )}
          <span className="toast-close" aria-hidden="true">
            <X />
          </span>
        </div>
      </div>
      <p className="shot-hint">
        <Pointer />
        <span>
          Experimente: clique num horário livre para agendar
          <span className="hint-drag"> ou arraste uma sessão</span>.
        </span>
      </p>
    </div>
  )
}
