import { CalendarDays, HardDrive, PanelLeft, Users } from 'lucide-react'
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, matchPath, NavLink, Outlet, useLocation } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { AuriLogo } from '@renderer/components/ui/brand'
import { ToastProvider } from '@renderer/components/ui/toast'
import { isMac, SIDEBAR_SHORTCUT } from '@renderer/lib/platform'
import { SidebarContext, useSidebar } from '@renderer/lib/sidebar'
import { cn } from '@renderer/lib/utils'

/** Altura de cada item do menu e o vão entre eles (`h-[34px]` e `gap-0.5`): o indicador anda de 36 em 36px. */
const NAV_ITEM_HEIGHT = 34
const NAV_GAP = 2

const NAV_ITEMS = [
  { to: '/agenda', label: 'Agenda', icon: <CalendarDays /> },
  { to: '/pacientes', label: 'Pacientes', icon: <Users /> }
]

/**
 * Menu principal. O fundo do item ativo é um bloco só, que desliza de um item ao outro (só
 * `transform`); o item guarda apenas o texto e o ícone em branco. A rota ativa é a que casa com o
 * começo do caminho, então a ficha de um paciente mantém "Pacientes" marcado.
 */
function SidebarNav(): React.JSX.Element {
  const { pathname } = useLocation()
  const active = NAV_ITEMS.findIndex(({ to }) => matchPath({ path: to, end: false }, pathname))
  return (
    <nav className="relative flex flex-col gap-0.5" aria-label="Principal">
      {active >= 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 rounded-control bg-white/[0.12] transition-transform duration-250 ease-slide"
          style={{
            height: NAV_ITEM_HEIGHT,
            transform: `translateY(${active * (NAV_ITEM_HEIGHT + NAV_GAP)}px)`
          }}
        />
      )}
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'relative flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-night-soft transition-colors hover:bg-white/[0.07] hover:text-night-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]',
              // ativo: texto branco (e aria-current, que o NavLink põe); o fundo é o indicador
              isActive && 'text-night-ink hover:bg-transparent'
            )
          }
        >
          {icon}
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

const SIDEBAR_WIDTH = 192

/** Onde fica o botão de recolher: logo depois dos botões da janela (Mac) ou no canto (Windows e web). */
const TOGGLE_LEFT = isMac ? 84 : 12
/** Lado do botão de recolher (`size-8`), em px. */
const TOGGLE_SIZE = 32
/** Espaço que o cabeçalho reserva à esquerda quando a barra está recolhida: botão da janela + botão. */
const HEADER_PAD_COLLAPSED = isMac ? 'pl-[136px]' : 'pl-[64px]'

/**
 * Botão de mostrar/ocultar a barra lateral. Fica sempre no mesmo lugar, ao lado dos botões da
 * janela, aberta ou recolhida a barra. Só o ícone, sem caixa nem contorno (o fundo aparece no
 * hover).
 */
function SidebarToggle(): React.JSX.Element {
  const { open, toggle } = useSidebar()
  const label = open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'
  return (
    <Button
      variant={open ? 'night' : 'ghost'}
      size="icon"
      className="no-drag [&_svg]:size-[18px]"
      onClick={toggle}
      aria-label={label}
      aria-expanded={open}
      aria-controls="sidebar"
      title={`${label} (${SIDEBAR_SHORTCUT})`}
    >
      <PanelLeft />
    </Button>
  )
}

/**
 * Estrutura do app: uma barra lateral sólida de grafite (o mesmo tom do ícone) à esquerda e o
 * conteúdo em branco, sem vidro, sem cartões e sem sombras, para ficar igual no Mac, no Windows e
 * na web. No Mac os botões da janela ficam sobre o grafite. A barra pode ser recolhida (botão ou
 * atalho); a escolha fica salva.
 */
export function Layout(): React.JSX.Element {
  // A escolha fica com o main (window.prefs), não no localStorage: ler o localStorage fazia a
  // primeira tela esperar o disco
  const [open, setOpen] = useState(() => window.prefs.initial.sidebarOpen)
  const toggle = useCallback(() => setOpen((current) => !current), [])

  useEffect(() => {
    window.prefs.save({ sidebarOpen: open })
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const key = e.key.toLowerCase()
      const hit = isMac
        ? e.ctrlKey && e.metaKey && !e.altKey && key === 's'
        : e.ctrlKey && !e.shiftKey && !e.altKey && key === 'b'
      if (!hit) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return (
    <SidebarContext value={{ open, toggle }}>
      <ToastProvider>
        <div className="relative h-full overflow-hidden bg-surface">
          <aside
            id="sidebar"
            inert={!open}
            style={{ width: SIDEBAR_WIDTH }}
            className={cn(
              'on-night absolute inset-y-0 left-0 z-20 flex flex-col bg-night px-3 pb-4 text-night-ink transition-[translate] duration-200 ease-out',
              !open && '-translate-x-full'
            )}
          >
            {/*
              faixa do título da janela: botões da janela, botão de recolher (que fica por cima, ver
              abaixo) e a marca logo depois dele, como o título de um app do Mac
            */}
            <div
              className="drag flex h-12 shrink-0 items-center"
              style={{ paddingLeft: TOGGLE_LEFT + TOGGLE_SIZE + 8 - 12 }}
            >
              {/* O centro visual das letras acompanha o ícone do botão ao lado. */}
              <AuriLogo className="w-12 -translate-y-0.5" />
            </div>
            <div className="h-3 shrink-0" />
            <SidebarNav />
            {/* mesmos px e gap dos itens do menu, para o ícone ficar na mesma coluna */}
            <p className="mt-auto flex items-center gap-2.5 px-3 text-xs leading-snug text-night-faint">
              <HardDrive className="size-[18px] shrink-0 stroke-[1.75]" aria-hidden="true" />
              Salvo neste computador
            </p>
          </aside>
          <div
            className={cn('absolute top-2 z-30', open && 'on-night')}
            style={{ left: TOGGLE_LEFT }}
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
      </ToastProvider>
    </SidebarContext>
  )
}

/**
 * A tela da rota atual, que entra com um fade curto e uma subida de 6px a cada troca de tela. A
 * `key` recria o contêiner só quando o caminho muda (navegar dentro da agenda não repete a
 * entrada). Vive aqui, e não no `Layout`, para só ele redesenhar a cada mudança de rota.
 */
function RouteFade(): React.JSX.Element {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="h-full animate-page-in">
      <Outlet />
    </div>
  )
}

/** Um passo da trilha do cabeçalho. Com `to`, vira link para aquela tela. */
export type Crumb = {
  label: ReactNode
  to?: string
}

type PageProps = {
  /**
   * Caminho até a tela atual, do mais geral ao mais específico (ex.: Pacientes / Maria Souza). O
   * último passo é o título da página; os anteriores com `to` levam de volta àquela tela.
   */
  trail: Crumb[]
  /** Ação principal, no fim da linha */
  actions?: ReactNode
  /** Ferramentas da página (busca, filtros, navegação), antes da ação principal */
  toolbar?: ReactNode
  children: ReactNode
  bodyClassName?: string
}

/**
 * Trilha do cabeçalho, como o caminho de um app de produtividade: passos anteriores apagados e
 * clicáveis, separados por "/", e o atual em destaque (é o `h1` da página). Os passos anteriores não
 * encolhem; quem corta, se faltar espaço, é o atual.
 */
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

/**
 * Página: uma barra de uma linha só (trilha à esquerda; ferramentas e ação principal à direita) e,
 * abaixo, o conteúdo, que rola sozinho. Sem filete entre as duas partes, em nenhuma tela: a
 * separação vem do espaço. As ferramentas e a ação principal usam a mesma altura (32px).
 * A barra é um contêiner (`@container`), então os itens podem se encolher conforme a largura
 * (ex.: `@min-[860px]:`); elementos `sticky top-0` do conteúdo (cabeçalho de tabela) param no topo
 * da área de rolagem, logo abaixo da barra.
 */
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
          // barra lateral recolhida: dar lugar aos botões da janela e ao botão de recolher
          !open && HEADER_PAD_COLLAPSED
        )}
      >
        {/*
          Com a barra lateral recolhida o botão de recolher fica sobre este cabeçalho, que é uma
          área de arrastar a janela. O Electron junta as áreas na ordem da árvore e o botão (que é
          irmão de <main>, mais acima) perde para o cabeçalho: o clique virava "arrastar a janela" e
          o menu não reabria. A exceção `no-drag` tem de ficar DENTRO do cabeçalho, no lugar do botão.
        */}
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
