import { CalendarDays, Check, Database, SlidersHorizontal, SunMoon, Users } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { AuriLogo, AuriSymbol } from '@renderer/components/ui/brand'
import { cn } from '@renderer/lib/utils'

type NavItem = { label: string; icon: ReactNode; active?: boolean }

const DAYS = [
  { weekday: 'Seg', day: 19 },
  { weekday: 'Ter', day: 20, today: true },
  { weekday: 'Qua', day: 21 },
  { weekday: 'Qui', day: 22 },
  { weekday: 'Sex', day: 23 }
]
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00']
const COLUMN = 68
const GUTTER = 46
const ROW = 44
const GRID_TOP = 84

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

function Window({ nav, children }: { nav: NavItem[]; children: ReactNode }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative h-[184px] overflow-hidden rounded-card bg-fill select-none"
    >
      <div
        className="absolute top-5 left-5 flex h-[272px] w-[560px] origin-top-left overflow-hidden rounded-card bg-surface text-ink shadow-pop"
        style={{ scale: 0.72 }}
      >
        <div className="w-[168px] shrink-0 bg-sidebar px-2 pt-4">
          <AuriLogo className="ml-3 w-11" />
          <div className="mt-5 flex flex-col gap-1.5">
            {nav.map(({ label, icon, active }) => (
              <div
                key={label}
                className={cn(
                  'flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-ink-soft [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
                  active && 'bg-fill-hover text-ink'
                )}
              >
                {icon}
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

function Trail({ from, to }: { from: string; to: string }): React.JSX.Element {
  return (
    <p className="absolute top-3.5 left-4 text-sm">
      <span className="text-ink-faint">{from}</span>
      <span className="mx-1.5 text-ink-faint">/</span>
      <span className="font-medium">{to}</span>
    </p>
  )
}

function Session({
  name,
  time,
  style,
  className
}: {
  name: string
  time: string
  style: CSSProperties
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'absolute rounded-chip bg-session px-2 py-1 leading-tight shadow-[inset_0_0_0_1px_var(--session-edge)]',
        className
      )}
      style={style}
    >
      <p className="text-[12.5px] font-semibold">{name}</p>
      <p className="text-[11px] text-ink-soft tabular-nums">{time}</p>
    </div>
  )
}

export function AgendaScene(): React.JSX.Element {
  return (
    <Window
      nav={[
        { label: 'Agenda', icon: <CalendarDays />, active: true },
        { label: 'Pacientes', icon: <Users /> }
      ]}
    >
      <Trail from="Agenda" to="19 a 23 de outubro" />
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
        </div>
      ))}
      <Session name="Helena" time="09:00" style={at(0, 0)} />
      <Session name="Davi" time="10:00" style={at(3, 1)} />
      <Session name="Laura" time="09:00" style={at(4, 0)} />
      <Session name="Maria" time="11:00" style={at(2, 2)} className="scene-agenda-new" />
      <Session
        name="Maria"
        time="11:00"
        style={at(2, 2)}
        className="scene-agenda-selected bg-solid text-on-solid [&_p+p]:text-on-solid/70"
      />
      <Ripple x={214} y={196} className="scene-ripple-first" />
      <Ripple x={222} y={204} className="scene-ripple-second" />
      <Cursor className="scene-agenda-cursor" />
    </Window>
  )
}

export function StorageScene(): React.JSX.Element {
  return (
    <Window
      nav={[
        { label: 'Geral', icon: <SlidersHorizontal /> },
        { label: 'Aparência', icon: <SunMoon /> },
        { label: 'Armazenamento', icon: <Database />, active: true }
      ]}
    >
      <Trail from="Configurações" to="Armazenamento" />
      <p className="absolute top-[60px] left-8 text-[15px] font-semibold tracking-tight">
        Cópia de segurança
      </p>
      <p className="absolute top-[84px] left-8 text-[13px] text-ink-soft">
        Uma cópia cifrada, numa pasta da nuvem.
      </p>
      <span className="scene-storage-dot absolute top-[126px] left-8 size-2 rounded-full bg-ink" />
      <p className="absolute top-[118px] left-12 text-[13px] font-medium">
        <span className="scene-storage-before absolute whitespace-nowrap opacity-0">
          Última cópia ontem às 19:00
        </span>
        <span className="scene-storage-after whitespace-nowrap">Última cópia agora</span>
      </p>
      <p className="absolute top-[138px] left-12 text-xs text-ink-soft">
        Google Drive · todo dia às 19:00
      </p>
      <div className="absolute top-[116px] right-6 flex h-8 items-center rounded-control bg-fill px-3.5 text-[13px] font-medium">
        <span className="scene-storage-label">Fazer cópia agora</span>
        <span className="scene-storage-loading absolute inset-0 flex items-center justify-center opacity-0">
          <AuriSymbol animated />
        </span>
      </div>
      <div className="scene-storage-toast absolute inset-x-0 top-[176px] mx-auto flex w-fit items-center gap-2 rounded-card bg-raised px-3.5 py-2.5 text-[13px] whitespace-nowrap shadow-pop">
        <Check className="size-4 stroke-[1.75]" />
        <span className="font-medium">Cópia feita</span>
        <span className="text-ink-soft">no Google Drive</span>
      </div>
      <Ripple x={298} y={132} className="scene-ripple-first" />
      <Cursor className="scene-storage-cursor" />
    </Window>
  )
}
