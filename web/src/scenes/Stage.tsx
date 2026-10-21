import { Fragment, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  Building,
  CalendarDays,
  Check,
  Database,
  Ellipsis,
  Keyboard,
  MessageCircle,
  PanelLeftClose,
  Settings,
  SlidersHorizontal,
  SunMoon,
  Undo,
  Users,
  Wallet,
  WindowLogo
} from '../components/icons'
import { useBrowserLayoutEffect } from '../lib/dom'
import { HEIGHT, WIDTH, type Beat, type useTimeline } from './timeline'
import './scenes.css'

function Cursor({ beats, beat, moving }: { beats: Beat[]; beat: number; moving: boolean }) {
  const cursor = useRef<HTMLSpanElement>(null)
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null)
  const last = useRef<string | undefined>(undefined)

  useBrowserLayoutEffect(() => {
    const element = cursor.current
    const stage = element?.parentElement
    if (!element || !stage) return
    const { to, click, hide } = beats[beat]
    if (beat === 0) last.current = undefined
    const name = to ?? last.current
    last.current = name
    const target = name ? stage.querySelector<HTMLElement>(`[data-target="${name}"]`) : null
    if (!target || hide || !moving) {
      element.style.opacity = '0'
      if (beat === 0 || !moving) element.style.transform = `translate(${WIDTH - 40}px, ${HEIGHT}px)`
      return
    }
    const scale = stage.getBoundingClientRect().width / WIDTH
    const box = target.getBoundingClientRect()
    const origin = stage.getBoundingClientRect()
    const x = (box.left - origin.left + box.width / 2) / scale
    const y = (box.top - origin.top + box.height / 2) / scale
    element.style.opacity = '1'
    element.style.transform = `translate(${x - 4}px, ${y - 3}px)`
    if (click) setRipple({ x, y, key: beat })
  }, [beat, beats, moving])

  return (
    <>
      {ripple && (
        <span
          key={ripple.key}
          className="sc-ripple"
          style={{ left: ripple.x - 16, top: ripple.y - 16 }}
        />
      )}
      <span ref={cursor} className="sc-cursor" aria-hidden="true">
        <svg
          key={ripple?.key}
          viewBox="0 0 24 24"
          className={ripple?.key === beat ? 'press' : undefined}
        >
          <path d="M5.3 3.6 20.1 9.8c1 .4.9 1.8-.2 2.1l-6.7 1.3-1.3 6.7c-.3 1.1-1.7 1.2-2.1.2L3.6 5.3c-.4-1 .7-2.1 1.7-1.7z" />
        </svg>
      </span>
    </>
  )
}

export function Stage({
  timeline,
  beats,
  label,
  children
}: {
  timeline: ReturnType<typeof useTimeline>
  beats: Beat[]
  label: string
  children: ReactNode
}) {
  const { ref: box, beat, moving } = timeline
  const [scale, setScale] = useState<number | null>(null)
  useBrowserLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setScale(element.clientWidth / WIDTH)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [box])
  return (
    <div ref={box} className="scene" role="img" aria-label={label}>
      <div
        className="scene-stage"
        aria-hidden="true"
        style={scale === null ? undefined : ({ '--s': scale } as CSSProperties)}
      >
        {children}
        <Cursor beats={beats} beat={beat} moving={moving} />
      </div>
    </div>
  )
}

const MAIN = [
  { label: 'Agenda', icon: <CalendarDays /> },
  { label: 'Pacientes', icon: <Users /> },
  { label: 'Financeiro', icon: <Wallet /> },
  { label: 'Clínica', icon: <Building /> },
  { label: 'WhatsApp', icon: <MessageCircle /> }
]

const SETTINGS = [
  { label: 'Geral', icon: <SlidersHorizontal /> },
  { label: 'Aparência', icon: <SunMoon /> },
  { label: 'Atalhos', icon: <Keyboard /> },
  { label: 'Armazenamento', icon: <Database /> }
]

export function Window({
  active,
  settings = false,
  trail,
  tools,
  overlay,
  children
}: {
  active: string
  settings?: boolean
  trail: string[]
  tools?: ReactNode
  overlay?: ReactNode
  children: ReactNode
}) {
  const items = settings ? SETTINGS : MAIN
  const index = items.findIndex((item) => item.label === active)
  return (
    <div className="win sc-win">
      <aside className="win-side">
        <div className="win-strip">
          <span className="lights">
            <i />
            <i />
            <i />
          </span>
          <span className="toggle">
            <PanelLeftClose />
          </span>
          <WindowLogo />
        </div>
        <nav className="win-nav" style={{ '--active': index } as CSSProperties}>
          <span className="nav-thumb" />
          {items.map((item) => (
            <span
              key={item.label}
              className="nav-item"
              data-active={item.label === active ? '' : undefined}
            >
              {item.icon}
              {item.label}
            </span>
          ))}
        </nav>
        {!settings && (
          <span className="nav-more">
            <Ellipsis />
          </span>
        )}
        <span className="win-foot">
          {settings ? <ArrowLeft /> : <Settings />}
          {settings ? 'Voltar' : 'Configurações'}
        </span>
      </aside>
      <div className="win-main">
        <div className="win-head">
          <div className="trail">
            {trail.map((part, i) =>
              i < trail.length - 1 ? (
                <Fragment key={part}>
                  <span className="crumb">{part}</span>
                  <span className="crumb-sep">/</span>
                </Fragment>
              ) : (
                <b key={part} className="crumb-current">
                  {part}
                </b>
              )
            )}
          </div>
          {tools && <div className="tools">{tools}</div>}
        </div>
        <div className="sc-body">{children}</div>
      </div>
      {overlay}
    </div>
  )
}

export function Toast({
  show,
  title,
  text,
  action
}: {
  show: boolean
  title: string
  text?: string
  action?: string
}) {
  return (
    <div className={`toast sc-toast${show ? ' show' : ''}`}>
      <span className="toast-icon">
        <Check />
      </span>
      <span className="toast-text">
        <b>{title}</b>
        {text && <span>{text}</span>}
      </span>
      {action && (
        <span className="toast-action">
          <Undo />
          {action}
        </span>
      )}
    </div>
  )
}
