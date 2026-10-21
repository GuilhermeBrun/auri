import {
  Building2,
  CalendarDays,
  Check,
  Database,
  Ellipsis,
  Keyboard,
  MessageCircle,
  PanelLeftClose,
  SlidersHorizontal,
  SunMoon,
  Users,
  Wallet
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { COR_PADRAO } from '@shared/tipos'
import { AuriLogo, AuriSymbol } from '@renderer/components/ui/brand'
import { cn } from '@renderer/lib/utils'

type NavItem = { label: string; icon: ReactNode; active?: boolean }

const DAYS = [
  { weekday: 'Seg', day: 19 },
  { weekday: 'Ter', day: 20, today: true },
  { weekday: 'Qua', day: 21 },
  { weekday: 'Qui', day: 22 },
  { weekday: 'Sex', day: 23 },
  { weekday: 'Sáb', day: 24 }
]
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00']
const COLUMN = 57
const GUTTER = 46
const ROW = 44
const GRID_TOP = 84
const SATURDAY = DAYS.length - 1
const SATURDAY_CLOSES = 3

function at(column: number, row: number): CSSProperties {
  return {
    left: GUTTER + column * COLUMN + 2,
    top: GRID_TOP + row * ROW + 2,
    width: COLUMN - 4,
    height: ROW - 4
  }
}

function Cursor({ className }: { className: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('scene-cursor absolute top-0 left-0 size-6', className)}
      focusable="false"
    >
      <path
        d="M5.3 3.6 20.1 9.8c1 .4.9 1.8-.2 2.1l-6.7 1.3-1.3 6.7c-.3 1.1-1.7 1.2-2.1.2L3.6 5.3c-.4-1 .7-2.1 1.7-1.7z"
        className="fill-ink stroke-surface"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Ripple({
  x,
  y,
  className
}: {
  x: number
  y: number
  className: string
}): React.JSX.Element {
  return (
    <span
      className={cn('scene-ripple absolute size-8 rounded-full bg-ink', className)}
      style={{ left: x - 16, top: y - 16 }}
    />
  )
}

const MAIN_NAV: NavItem[] = [
  { label: 'Agenda', icon: <CalendarDays />, active: true },
  { label: 'Pacientes', icon: <Users /> },
  { label: 'Financeiro', icon: <Wallet /> },
  { label: 'Clínica', icon: <Building2 /> },
  { label: 'WhatsApp', icon: <MessageCircle /> }
]

const SETTINGS_NAV: NavItem[] = [
  { label: 'Geral', icon: <SlidersHorizontal /> },
  { label: 'Aparência', icon: <SunMoon /> },
  { label: 'Atalhos', icon: <Keyboard /> },
  { label: 'Armazenamento', icon: <Database />, active: true }
]

const navItemClass =
  'flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-ink-soft [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]'

function Window({
  nav,
  more = false,
  children
}: {
  nav: NavItem[]
  more?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative h-[184px] overflow-hidden rounded-card bg-fill select-none"
    >
      <div
        className="absolute top-5 left-5 flex h-[272px] w-[560px] origin-top-left overflow-hidden rounded-card bg-surface text-ink shadow-pop"
        style={{ scale: 0.72 }}
      >
        <div className="w-[168px] shrink-0 bg-sidebar px-2 pt-3">
          <div className="flex items-center gap-2 pl-2.5">
            <PanelLeftClose className="size-[18px] stroke-[1.75] text-ink-soft" />
            <AuriLogo className="w-11" />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            {nav.map(({ label, icon, active }) => (
              <div key={label} className={cn(navItemClass, active && 'bg-fill-hover text-ink')}>
                {icon}
                {label}
              </div>
            ))}
            {more && (
              <div className={cn(navItemClass, 'w-10 justify-center px-0')}>
                <Ellipsis />
              </div>
            )}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

function Trail({ parts }: { parts: string[] }): React.JSX.Element {
  return (
    <p className="absolute top-3.5 left-4 text-sm whitespace-nowrap">
      {parts.map((part, i) =>
        i < parts.length - 1 ? (
          <span key={part} className="text-ink-faint">
            {part}
            <span className="mx-1.5 opacity-60">/</span>
          </span>
        ) : (
          <span key={part} className="font-medium">
            {part}
          </span>
        )
      )}
    </p>
  )
}

function Session({
  name,
  time,
  style,
  avaliacao = false,
  className
}: {
  name: string
  time: string
  style: CSSProperties
  avaliacao?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn('scene-session absolute rounded-chip py-[3px] pr-1.5 pl-2.5', className)}
      style={
        { ...style, '--cor': avaliacao ? COR_PADRAO.avaliacao : COR_PADRAO.sessao } as CSSProperties
      }
    >
      <p className="truncate text-[12.5px] leading-tight font-semibold">{name}</p>
      <p className="truncate text-[11px] leading-tight text-ink-soft tabular-nums">{time}</p>
    </div>
  )
}

export function AgendaScene(): React.JSX.Element {
  return (
    <Window nav={MAIN_NAV} more>
      <Trail parts={['Agenda', '19 a 24 de outubro 2026']} />
      {DAYS.map(({ weekday, day, today }, i) => (
        <div
          key={day}
          className="absolute top-12 flex flex-col items-center text-xs text-ink-soft"
          style={{ left: GUTTER + i * COLUMN, width: COLUMN }}
        >
          {weekday}
          <span
            className={cn(
              'mt-0.5 rounded-chip px-1.5 text-[13px] font-semibold tabular-nums',
              today ? 'bg-solid text-on-solid' : 'text-ink'
            )}
          >
            {day}
          </span>
        </div>
      ))}
      <span
        className="absolute right-0 bottom-0 bg-subtle"
        style={{
          left: GUTTER + SATURDAY * COLUMN,
          top: GRID_TOP + SATURDAY_CLOSES * ROW
        }}
      />
      {HOURS.map((hour, i) => (
        <div key={hour}>
          <span
            className="absolute left-2 text-[11px] text-ink-faint tabular-nums"
            style={{ top: GRID_TOP + i * ROW - 7 }}
          >
            {hour}
          </span>
          <span
            className="absolute right-0 h-px bg-line"
            style={{ left: GUTTER, top: GRID_TOP + i * ROW }}
          />
          <span
            className="absolute right-0 border-t border-dashed border-line"
            style={{ left: GUTTER, top: GRID_TOP + i * ROW + ROW / 2 }}
          />
        </div>
      ))}
      <Session name="Alice" time="09:00" style={at(0, 0)} />
      <Session name="Davi" time="10:00" style={at(3, 1)} avaliacao />
      <Session name="Laura" time="09:00" style={at(4, 0)} />
      <Session name="Bruno" time="11:00" style={at(5, 2)} />
      <Session name="Maria" time="11:00" style={at(2, 2)} className="scene-agenda-new" />
      <Session
        name="Maria"
        time="11:00"
        style={at(2, 2)}
        className="scene-agenda-selected scene-session-selected"
      />
      <Ripple x={188} y={194} className="scene-ripple-first" />
      <Ripple x={196} y={202} className="scene-ripple-second" />
      <Cursor className="scene-agenda-cursor" />
    </Window>
  )
}

function Divider({ top }: { top: number }): React.JSX.Element {
  return <span className="absolute right-6 left-8 h-px bg-line" style={{ top }} />
}

export function StorageScene(): React.JSX.Element {
  return (
    <Window nav={SETTINGS_NAV}>
      <Trail parts={['Configurações', 'Armazenamento', 'Cópia de segurança']} />
      <p className="absolute top-[56px] left-8 text-[15px] font-semibold tracking-tight">
        Cópia de segurança
      </p>
      <span className="absolute top-[97px] left-8 size-2 rounded-full bg-ink" />
      <div className="absolute top-[90px] left-12 whitespace-nowrap">
        <p className="relative text-[13px] font-medium">
          <span className="scene-storage-before absolute opacity-0">
            Última cópia ontem às 19:00
          </span>
          <span className="scene-storage-after">Última cópia hoje às 10:12</span>
        </p>
        <p className="relative text-xs text-ink-soft">
          <span className="scene-storage-before absolute opacity-0">
            Google Drive · 12 cópias · 45 MB
          </span>
          <span className="scene-storage-after">Google Drive · 13 cópias · 49 MB</span>
        </p>
      </div>
      <div className="absolute top-[92px] right-6 flex h-8 items-center rounded-control bg-fill px-3.5 text-[13px] font-medium">
        <span className="scene-storage-label">Fazer cópia agora</span>
        <span className="scene-storage-loading absolute inset-0 flex items-center justify-center opacity-0">
          <span className="relative size-4">
            <AuriSymbol className="absolute inset-0 size-full opacity-25" />
            <span className="scene-storage-fill absolute inset-0">
              <AuriSymbol className="size-full" />
            </span>
          </span>
        </span>
      </div>
      <Divider top={140} />
      <p className="absolute top-[156px] left-8 text-[13px] font-medium">Google Drive</p>
      <p className="absolute top-[176px] left-8 text-xs text-ink-soft blur-[0.4em]">
        Google Drive/Auri/Cópias
      </p>
      <div className="absolute top-[156px] right-6 flex h-8 items-center rounded-control bg-fill px-3.5 text-[13px] font-medium">
        Trocar
      </div>
      <Divider top={210} />
      <p className="absolute top-[226px] left-8 text-[13px] font-medium">Senha</p>
      <div className="scene-storage-toast absolute inset-x-0 top-[168px] mx-auto flex w-fit items-center gap-2 rounded-card bg-raised px-3.5 py-2.5 text-[13px] whitespace-nowrap shadow-pop">
        <Check className="size-4 stroke-[1.75]" />
        <span className="font-medium">Cópia feita</span>
      </div>
      <Ripple x={305} y={108} className="scene-ripple-first" />
      <Cursor className="scene-storage-cursor" />
    </Window>
  )
}
