import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CalendarDays,
  DatabaseBackup,
  Network,
  PanelLeft,
  PanelLeftClose,
  Settings,
  SlidersHorizontal,
  SunMoon,
  TriangleAlert,
  Users,
  WifiOff
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { AuriLogo } from '@renderer/components/ui/brand'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { ErrorState } from '@renderer/components/ui/error'
import { ToastProvider } from '@renderer/components/ui/toast'
import { UpdateCorner } from '@renderer/components/UpdateCorner'
import { UpdateReady } from '@renderer/components/UpdateReady'
import { WelcomeDialog } from '@renderer/components/WelcomeDialog'
import { needsAttention, useBackup } from '@renderer/lib/backup'
import { useConnection } from '@renderer/lib/connection'
import { isMac, SETTINGS_SHORTCUT, SIDEBAR_SHORTCUT } from '@renderer/lib/platform'
import { SidebarContext, useSidebar } from '@renderer/lib/sidebar'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

const NAV_ITEM_HEIGHT = 34
const NAV_GAP = 6

const navItemClass =
  'relative flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-fill hover:text-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  alert?: boolean
}

function AlertDot(): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-attention" />
      <span className="sr-only">(precisa de atenção)</span>
    </>
  )
}

const NAV_ITEMS: NavItem[] = [
  { to: '/agenda', label: 'Agenda', icon: <CalendarDays /> },
  { to: '/pacientes', label: 'Pacientes', icon: <Users /> },
  { to: '/clinica', label: 'Clínica', icon: <Building2 /> }
]

const SETTINGS_PATH = '/configuracoes'
const CONNECTION_PATH = `${SETTINGS_PATH}/conexao`
const BACKUP_PATH = `${SETTINGS_PATH}/copia`
const SETTINGS_ITEMS: NavItem[] = [
  { to: `${SETTINGS_PATH}/geral`, label: 'Geral', icon: <SlidersHorizontal /> },
  { to: `${SETTINGS_PATH}/aparencia`, label: 'Aparência', icon: <SunMoon /> },
  { to: CONNECTION_PATH, label: 'Conexão', icon: <Network /> },
  { to: BACKUP_PATH, label: 'Cópia de segurança', icon: <DatabaseBackup /> },
  { to: `${SETTINGS_PATH}/transferir`, label: 'Importar e exportar', icon: <ArrowLeftRight /> }
]

function SidebarNav({
  items,
  label,
  pathname
}: {
  items: NavItem[]
  label: string
  pathname: string
}): React.JSX.Element {
  const active = items.findIndex(({ to }) => matchPath({ path: to, end: false }, pathname))
  return (
    <nav className="relative flex flex-col gap-1.5" aria-label={label}>
      {active >= 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 rounded-control bg-fill-hover transition-transform duration-250 ease-slide"
          style={{
            height: NAV_ITEM_HEIGHT,
            transform: `translateY(${active * (NAV_ITEM_HEIGHT + NAV_GAP)}px)`
          }}
        />
      )}
      {items.map(({ to, label, icon, alert }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(navItemClass, isActive && 'text-ink hover:bg-transparent')
          }
        >
          {icon}
          {label}
          {alert && <AlertDot />}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarBody(): React.JSX.Element {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const inSettings = matchPath({ path: SETTINGS_PATH, end: false }, pathname) !== null
  const attention = needsAttention(useBackup())
  const backTo = useRef('/agenda')
  useEffect(() => {
    if (!inSettings) backTo.current = pathname
  }, [inSettings, pathname])

  if (inSettings) {
    return (
      <div key="configuracoes" className="flex flex-1 animate-fade-in flex-col">
        <SidebarNav
          items={SETTINGS_ITEMS.map((item) =>
            item.to === BACKUP_PATH ? { ...item, alert: attention } : item
          )}
          label="Configurações"
          pathname={pathname}
        />
        <div className="mt-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(backTo.current)}
            className={cn(navItemClass, 'min-w-0 flex-1')}
          >
            <ArrowLeft aria-hidden="true" />
            Voltar
          </button>
          <UpdateCorner />
        </div>
      </div>
    )
  }

  return (
    <div key="principal" className="flex flex-1 animate-fade-in flex-col">
      <SidebarNav items={NAV_ITEMS} label="Principal" pathname={pathname} />
      <Link
        to={attention ? BACKUP_PATH : SETTINGS_PATH}
        title={`Configurações (${SETTINGS_SHORTCUT})`}
        className={cn(navItemClass, 'mt-auto')}
      >
        <Settings aria-hidden="true" />
        Configurações
        {attention && <AlertDot />}
      </Link>
    </div>
  )
}

function BackupAttention(): null {
  const info = useBackup()
  const toast = useToast()
  const navigate = useNavigate()
  const shown = useRef(false)
  const attention = needsAttention(info)
  const message = info?.destinationProblem?.message
  useEffect(() => {
    if (!attention || shown.current) return
    shown.current = true
    toast({
      title: 'A cópia de segurança parou',
      description: message ?? 'Veja em Configurações › Cópia de segurança.',
      icon: <TriangleAlert className="text-warning" />,
      action: {
        label: 'Resolver',
        altText: 'Abra Configurações › Cópia de segurança.',
        onClick: () => void navigate('/configuracoes/copia')
      }
    })
  }, [attention, message, toast, navigate])
  return null
}

const SIDEBAR_WIDTH = 216

const TOGGLE_LEFT = isMac ? 84 : 12
const TOGGLE_SIZE = 32
const HEADER_PAD_COLLAPSED = isMac ? 'pl-[136px]' : 'pl-[64px]'

function SidebarToggle(): React.JSX.Element {
  const { open, toggle } = useSidebar()
  const label = open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'
  return (
    <Button
      variant="ghost"
      size="icon"
      className="no-drag [&_svg]:size-[18px]"
      onClick={toggle}
      aria-label={label}
      aria-expanded={open}
      aria-controls="sidebar"
      title={`${label} (${SIDEBAR_SHORTCUT})`}
    >
      {open ? <PanelLeftClose /> : <PanelLeft />}
    </Button>
  )
}

export function Layout(): React.JSX.Element {
  const [open, setOpen] = useState(() => window.prefs.initial.sidebarOpen)
  const toggle = useCallback(() => setOpen((current) => !current), [])
  const navigate = useNavigate()

  useEffect(() => {
    window.prefs.save({ sidebarOpen: open })
  }, [open])

  useEffect(() => window.prefs.onChange((prefs) => setOpen(prefs.sidebarOpen)), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const key = e.key.toLowerCase()
      const sidebar = isMac
        ? e.ctrlKey && e.metaKey && !e.altKey && key === 's'
        : e.ctrlKey && !e.shiftKey && !e.altKey && key === 'b'
      const settings =
        (isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey) && !e.shiftKey && !e.altKey && key === ','
      if (!sidebar && !settings) return
      e.preventDefault()
      if (sidebar) toggle()
      else void navigate(SETTINGS_PATH)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle, navigate])

  return (
    <SidebarContext value={{ open, toggle }}>
      <ToastProvider>
        <div className="relative h-full overflow-hidden bg-surface">
          <aside
            id="sidebar"
            inert={!open}
            style={{ width: SIDEBAR_WIDTH }}
            className={cn(
              'absolute inset-y-0 left-0 z-20 flex flex-col bg-sidebar px-3 pb-3 text-ink transition-[translate] duration-200 ease-out',
              !open && '-translate-x-full'
            )}
          >
            <div
              className="drag flex h-12 shrink-0 items-center"
              style={{ paddingLeft: TOGGLE_LEFT + TOGGLE_SIZE + 8 - 12 }}
            >
              <AuriLogo className="w-12 -translate-y-0.5" />
            </div>
            <div className="h-3 shrink-0" />
            <SidebarBody />
          </aside>
          <div className="absolute top-2 z-30" style={{ left: TOGGLE_LEFT }}>
            <SidebarToggle />
          </div>
          <main
            className="h-full min-w-0 overflow-hidden transition-[padding] duration-200 ease-out"
            style={{ paddingLeft: open ? SIDEBAR_WIDTH : 0 }}
          >
            <RouteFade />
          </main>
        </div>
        <WelcomeDialog />
        <BackupAttention />
        <UpdateReady />
      </ToastProvider>
    </SidebarContext>
  )
}

function RouteFade(): React.JSX.Element {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="h-full animate-page-in">
      <ErrorBoundary>
        <ConnectionGate
          inSettings={matchPath({ path: SETTINGS_PATH, end: false }, pathname) !== null}
        >
          <Outlet />
        </ConnectionGate>
      </ErrorBoundary>
    </div>
  )
}

function ConnectionGate({
  inSettings,
  children
}: {
  inSettings: boolean
  children: ReactNode
}): React.JSX.Element {
  const { info, everConnected } = useConnection()
  const navigate = useNavigate()
  const toast = useToast()
  const status = info?.status
  const server = info?.server?.name ?? 'o outro computador'

  const previous = useRef(status)
  useEffect(() => {
    if (previous.current === 'offline' && status === 'connected') {
      toast({ title: 'Conectado de novo', description: server })
    }
    previous.current = status
  }, [status, server, toast])

  if (!info || inSettings || status === 'local' || status === 'connected') return <>{children}</>
  if (status === 'connecting') return <>{children}</>
  if (status === 'offline' && everConnected) {
    return (
      <>
        {children}
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 flex animate-fade-in items-center gap-3 rounded-card bg-raised py-2.5 pr-4 pl-3 text-ink shadow-pop"
        >
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-chip bg-fill [&_svg]:size-4 [&_svg]:stroke-[1.75]"
          >
            <WifiOff />
          </span>
          <div>
            <p className="text-[13px] leading-tight font-medium">Sem conexão com {server}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tentando reconectar. Até lá, nada pode ser salvo.
            </p>
          </div>
        </div>
      </>
    )
  }

  const openSettings = (
    <Button variant="secondary" onClick={() => navigate(CONNECTION_PATH)}>
      <Network /> Abrir Conexão
    </Button>
  )
  return (
    <Page trail={[{ label: info.server?.name ?? 'Conexão' }]}>
      {status === 'unpaired' ? (
        <EmptyState icon={<Network />} title="Conecte este computador" action={openSettings}>
          Ele está configurado para usar os dados de outro computador, mas ainda não foi conectado a
          nenhum.
        </EmptyState>
      ) : status === 'version' ? (
        <ErrorState
          title="Versões diferentes do Auri"
          onRetry={() => void window.connection.retry()}
        >
          {server} usa outra versão do Auri. Atualize os dois computadores para a mesma versão.
        </ErrorState>
      ) : status === 'revoked' ? (
        <ErrorState title={`Este computador foi desconectado de ${server}`}>
          Para voltar a usar os dados, conecte de novo em Configurações / Conexão, com um código
          gerado em {server}.<span className="mt-4 flex justify-center">{openSettings}</span>
        </ErrorState>
      ) : (
        <ErrorState
          title={`Sem conexão com ${server}`}
          onRetry={() => void window.connection.retry()}
        >
          Confira se o Auri está aberto em {server} e se os dois computadores estão na mesma rede. O
          Auri continua tentando sozinho.
        </ErrorState>
      )}
    </Page>
  )
}

export type Crumb = {
  label: ReactNode
  to?: string
}

type PageProps = {
  trail: Crumb[]
  actions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  bodyClassName?: string
}

function Breadcrumbs({ trail }: { trail: Crumb[] }): React.JSX.Element {
  return (
    <nav aria-label="Caminho" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {trail.map((crumb, i) => {
          const current = i === trail.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden="true" className="shrink-0 text-ink-faint/60 select-none">
                  /
                </li>
              )}
              <li className={cn('flex', current ? 'min-w-0' : 'shrink-0')}>
                {current ? (
                  <h1
                    aria-current="page"
                    className="truncate font-medium text-ink first-letter:uppercase"
                  >
                    {crumb.label}
                  </h1>
                ) : crumb.to ? (
                  <Link
                    to={crumb.to}
                    className="no-drag -mx-1 rounded-chip px-1 py-0.5 text-ink-faint transition-colors hover:bg-fill hover:text-ink"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink-faint">{crumb.label}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

export function Page({
  trail,
  actions,
  toolbar,
  children,
  bodyClassName
}: PageProps): React.JSX.Element {
  const { open } = useSidebar()
  return (
    <div className="flex h-full flex-col">
      <header
        className={cn(
          '@container drag relative flex h-12 shrink-0 items-center gap-3 px-6 transition-[padding] duration-200 ease-out',
          !open && HEADER_PAD_COLLAPSED
        )}
      >
        {!open && (
          <div
            aria-hidden="true"
            className="no-drag pointer-events-none absolute inset-y-0"
            style={{ left: TOGGLE_LEFT - 4, width: TOGGLE_SIZE + 8 }}
          />
        )}
        <Breadcrumbs trail={trail} />
        <div className="no-drag ml-auto flex shrink-0 items-center gap-2">
          {toolbar}
          {actions}
        </div>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
    </div>
  )
}
