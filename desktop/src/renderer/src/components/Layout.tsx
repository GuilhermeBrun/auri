import {
  ArrowLeft,
  Database,
  Keyboard,
  Network,
  PanelLeft,
  PanelLeftClose,
  Settings,
  SlidersHorizontal,
  SunMoon,
  TriangleAlert,
  WifiOff
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import type { SidebarItemId } from '@shared/sidebar'
import { AgendaNotices } from '@renderer/components/AgendaNotices'
import { Button } from '@renderer/components/ui/button'
import { AuriLogo } from '@renderer/components/ui/brand'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { ErrorState } from '@renderer/components/ui/error'
import { ToastProvider } from '@renderer/components/ui/toast'
import { UpdateCorner } from '@renderer/components/UpdateCorner'
import { UpdateReady } from '@renderer/components/UpdateReady'
import { WelcomeDialog } from '@renderer/components/WelcomeDialog'
import { ReceiveTerm } from '@renderer/components/ReceiveTerm'
import { ReceberConfirmacao } from '@renderer/components/confirmacao/ReceberConfirmacao'
import { useIncomingConfirmacoes } from '@renderer/lib/confirmacoes'
import { useIncomingTerms } from '@renderer/lib/terms'
import { needsAttention, useBackup } from '@renderer/lib/backup'
import { useConnection } from '@renderer/lib/connection'
import { isMac } from '@renderer/lib/platform'
import {
  comAtalho,
  textoDaTecla,
  useAtalhos,
  useTeclas,
  useTextoDoAtalho
} from '@renderer/lib/atalhos'
import { SidebarEditor } from '@renderer/components/SidebarEditor'
import {
  NAV_GAP,
  NAV_ITEM_HEIGHT,
  navItemClass,
  SIDEBAR_ICONS,
  SidebarContext,
  useAvailableItems,
  useHomePath,
  useSidebar,
  useVisibleItems
} from '@renderer/lib/sidebar'
import { useZoom } from '@renderer/lib/theme'
import { useToast } from '@renderer/lib/toast'
import { useWhatsAppEnabled, useWhatsAppUnread } from '@renderer/lib/whatsapp'
import { cn } from '@renderer/lib/utils'

type NavItem = {
  to: string
  label: string
  title?: string
  icon: ReactNode
  alert?: boolean
  badge?: number
}

function AlertDot(): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-attention" />
      <span className="sr-only">(precisa de atenção)</span>
    </>
  )
}

const WHATSAPP_PATH = '/whatsapp'

function Badge({ count }: { count: number }): React.JSX.Element {
  return (
    <span className="ml-auto min-w-5 rounded-full bg-fill-hover px-1.5 text-center text-xs leading-5 font-semibold text-ink tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lidas</span>
    </span>
  )
}

const SETTINGS_PATH = '/configuracoes'
const STORAGE_PATH = `${SETTINGS_PATH}/armazenamento`
const CONNECTION_PATH = `${STORAGE_PATH}?secao=conexao`
const BACKUP_PATH = `${STORAGE_PATH}?secao=copia`
const SETTINGS_ITEMS: NavItem[] = [
  { to: `${SETTINGS_PATH}/geral`, label: 'Geral', icon: <SlidersHorizontal /> },
  { to: `${SETTINGS_PATH}/aparencia`, label: 'Aparência', icon: <SunMoon /> },
  { to: `${SETTINGS_PATH}/atalhos`, label: 'Atalhos', icon: <Keyboard /> },
  { to: STORAGE_PATH, label: 'Armazenamento', icon: <Database /> }
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
      {items.map(({ to, label, title, icon, alert, badge }) => (
        <NavLink
          key={to}
          to={to}
          title={title}
          className={({ isActive }) =>
            cn(navItemClass, isActive && 'text-ink hover:bg-transparent')
          }
        >
          {icon}
          {label}
          {alert && <AlertDot />}
          {!alert && badge ? <Badge count={badge} /> : null}
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
  const whatsapp = useWhatsAppEnabled()
  const unread = useWhatsAppUnread(whatsapp)
  const visible = useVisibleItems()
  const teclas = useTeclas()
  const settingsShortcut = useTextoDoAtalho('configuracoes')
  const backTo = useRef(useHomePath())
  useEffect(() => {
    if (!inSettings) backTo.current = pathname
  }, [inSettings, pathname])

  if (inSettings) {
    return (
      <div key="configuracoes" className="flex flex-1 animate-fade-in flex-col">
        <SidebarNav
          items={SETTINGS_ITEMS.map((item) =>
            item.to === STORAGE_PATH ? { ...item, alert: attention } : item
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
      <SidebarNav
        items={visible.map((item) => {
          const Icon = SIDEBAR_ICONS[item.id]
          return {
            to: item.path,
            label: item.label,
            title: comAtalho(item.label, textoDaTecla(teclas[`ir-${item.id}`])),
            icon: <Icon />,
            badge: item.id === 'whatsapp' ? unread : undefined
          }
        })}
        label="Principal"
        pathname={pathname}
      />
      <SidebarEditor />
      <Link
        to={attention ? BACKUP_PATH : SETTINGS_PATH}
        title={comAtalho('Configurações', settingsShortcut)}
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
      description: message,
      icon: <TriangleAlert className="text-warning" />,
      action: {
        label: 'Resolver',
        altText: 'Abra Configurações › Armazenamento.',
        onClick: () => void navigate(BACKUP_PATH)
      }
    })
  }, [attention, message, toast, navigate])
  return null
}

const SIDEBAR_WIDTH = 216

const TOGGLE_SIZE = 32

function useToggleLeft(): number {
  const zoom = useZoom()
  return isMac ? 84 / zoom : 12
}

function SidebarToggle(): React.JSX.Element {
  const { open, toggle } = useSidebar()
  const label = open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'
  const shortcut = useTextoDoAtalho('barra-lateral')
  return (
    <Button
      variant="ghost"
      size="icon"
      className="no-drag [&_svg]:size-[18px]"
      onClick={toggle}
      aria-label={label}
      aria-expanded={open}
      aria-controls="sidebar"
      title={comAtalho(label, shortcut)}
    >
      {open ? <PanelLeftClose /> : <PanelLeft />}
    </Button>
  )
}

export function Layout(): React.JSX.Element {
  const toggleLeft = useToggleLeft()
  const [open, setOpen] = useState(() => window.prefs.initial.sidebarOpen)
  const toggle = useCallback(() => setOpen((current) => !current), [])
  const navigate = useNavigate()
  useIncomingTerms()
  useIncomingConfirmacoes()

  useEffect(() => {
    window.prefs.save({ sidebarOpen: open })
  }, [open])

  useEffect(() => window.prefs.onChange((prefs) => setOpen(prefs.sidebarOpen)), [])

  useEffect(() => window.whatsapp.onOpen(() => void navigate(WHATSAPP_PATH)), [navigate])

  useEffect(() => window.prefs.onOpenSettings(() => void navigate(SETTINGS_PATH)), [navigate])

  const available = useAvailableItems()
  const goTo = (id: SidebarItemId) => (): void => {
    const item = available.find((i) => i.id === id)
    if (item && !(item.id === 'whatsapp' && item.hidden)) void navigate(item.path)
  }
  useAtalhos({
    'barra-lateral': toggle,
    configuracoes: () => void navigate(SETTINGS_PATH),
    'buscar-paciente': () => void navigate('/pacientes', { state: { buscar: Date.now() } }),
    voltar: () => void navigate(-1),
    avancar: () => void navigate(1),
    'ir-agenda': goTo('agenda'),
    'ir-pacientes': goTo('pacientes'),
    'ir-financeiro': goTo('financeiro'),
    'ir-clinica': goTo('clinica'),
    'ir-whatsapp': goTo('whatsapp')
  })

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
              style={{ paddingLeft: toggleLeft + TOGGLE_SIZE + 8 - 12 }}
            >
              <AuriLogo className="w-12 -translate-y-0.5" />
            </div>
            <div className="h-3 shrink-0" />
            <SidebarBody />
          </aside>
          <div
            className="absolute top-2 z-30"
            style={{ left: toggleLeft }}
            data-on-sidebar={open ? '' : undefined}
          >
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
        <ReceiveTerm />
        <ReceberConfirmacao />
        <BackupAttention />
        <UpdateReady />
        <AgendaNotices />
      </ToastProvider>
    </SidebarContext>
  )
}

function pageOf(pathname: string): string {
  const patient = matchPath({ path: '/pacientes/:id', end: false }, pathname)
  if (patient && patient.params.id !== 'novo') return patient.pathnameBase
  if (matchPath({ path: SETTINGS_PATH, end: false }, pathname)) return SETTINGS_PATH
  return pathname
}

function RouteFade(): React.JSX.Element {
  const { pathname } = useLocation()
  return (
    <div key={pageOf(pathname)} className="h-full animate-page-in">
      <ErrorBoundary key={pathname}>
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
        <EmptyState icon={<Network />} title="Conecte este computador" action={openSettings} />
      ) : status === 'version' ? (
        <ErrorState
          title="Versões diferentes do Auri"
          onRetry={() => void window.connection.retry()}
        >
          {server} usa outra versão. Atualize os dois.
        </ErrorState>
      ) : status === 'revoked' ? (
        <ErrorState title={`Este computador foi desconectado de ${server}`}>
          Conecte de novo com um código gerado em {server}.
          <span className="mt-4 flex justify-center">{openSettings}</span>
        </ErrorState>
      ) : (
        <ErrorState
          title={`Sem conexão com ${server}`}
          onRetry={() => void window.connection.retry()}
        >
          Confira se o Auri está aberto em {server} e na mesma rede.
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

const crumbLinkClass =
  'no-drag -mx-1 min-w-0 truncate rounded-chip px-1 py-0.5 text-ink-faint transition-colors hover:bg-fill hover:text-ink'

function Separator(): React.JSX.Element {
  return (
    <li aria-hidden="true" className="shrink-0 text-ink-faint/60 select-none">
      /
    </li>
  )
}

function Breadcrumbs({
  trail,
  section,
  onTop
}: {
  trail: Crumb[]
  section: string | null
  onTop: () => void
}): React.JSX.Element {
  return (
    <nav aria-label="Caminho" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {trail.map((crumb, i) => {
          const current = i === trail.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <Separator />}
              <li className={cn('flex', i > 0 ? 'min-w-0' : 'shrink-0')}>
                {current ? (
                  <h1
                    aria-current={section ? undefined : 'page'}
                    className={cn(
                      'min-w-0',
                      section ? 'flex' : 'truncate font-medium text-ink first-letter:uppercase'
                    )}
                  >
                    {section ? (
                      <button type="button" onClick={onTop} className={crumbLinkClass}>
                        {crumb.label}
                      </button>
                    ) : (
                      crumb.label
                    )}
                  </h1>
                ) : crumb.to ? (
                  <Link to={crumb.to} className={crumbLinkClass}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-ink-faint">{crumb.label}</span>
                )}
              </li>
            </Fragment>
          )
        })}
        {section && (
          <>
            <Separator />
            <li className="flex min-w-0">
              <span
                key={section}
                aria-current="location"
                className="animate-fade-in truncate font-medium text-ink"
              >
                {section}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}

const SECTION_LINE = 64

function useSectionCrumb(body: React.RefObject<HTMLDivElement | null>): string | null {
  const [section, setSection] = useState<string | null>(null)
  useEffect(() => {
    const el = body.current
    if (!el) return
    let frame = 0
    let sections: HTMLElement[] = []
    const update = (): void => {
      frame = 0
      if (sections.length === 0) {
        setSection(null)
        return
      }
      const max = el.scrollHeight - el.clientHeight
      const progress = max > 1 ? Math.min(el.scrollTop / max, 1) : 0
      const line =
        el.getBoundingClientRect().top + SECTION_LINE + progress * (el.clientHeight - SECTION_LINE)
      let current = sections[0]
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= line) current = s
      }
      setSection(current.dataset.crumb ?? null)
    }
    const schedule = (): void => {
      if (!frame && sections.length > 0) frame = requestAnimationFrame(update)
    }
    const collect = (): void => {
      sections = [...el.querySelectorAll<HTMLElement>('[data-crumb]')]
      if (sections.length === 0) setSection(null)
      schedule()
    }
    collect()
    el.addEventListener('scroll', schedule, { passive: true })
    const resize = new ResizeObserver(collect)
    resize.observe(el)
    for (const child of el.children) resize.observe(child)
    return () => {
      el.removeEventListener('scroll', schedule)
      resize.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [body])
  return section
}

export function Page({
  trail,
  actions,
  toolbar,
  children,
  bodyClassName
}: PageProps): React.JSX.Element {
  const { open } = useSidebar()
  const toggleLeft = useToggleLeft()
  const body = useRef<HTMLDivElement>(null)
  const section = useSectionCrumb(body)
  const toTop = useCallback(() => {
    const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    body.current?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  }, [])
  return (
    <div className="flex h-full flex-col">
      <header
        className="@container drag relative flex h-12 shrink-0 items-center gap-3 px-6 transition-[padding] duration-200 ease-out"
        style={open ? undefined : { paddingLeft: toggleLeft + TOGGLE_SIZE + 20 }}
      >
        {!open && (
          <div
            aria-hidden="true"
            className="no-drag pointer-events-none absolute inset-y-0"
            style={{ left: toggleLeft - 4, width: TOGGLE_SIZE + 8 }}
          />
        )}
        <Breadcrumbs trail={trail} section={section} onTop={toTop} />
        <div className="no-drag ml-auto flex shrink-0 items-center gap-2">
          {toolbar}
          {actions}
        </div>
      </header>
      <div ref={body} className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>
        {children}
      </div>
    </div>
  )
}
