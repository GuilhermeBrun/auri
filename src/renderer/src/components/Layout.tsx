import { CalendarDays, HardDrive, PanelLeft, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { isMac, SIDEBAR_SHORTCUT } from '@renderer/lib/platform'
import { SidebarContext, useSidebar } from '@renderer/lib/sidebar'
import { cn } from '@renderer/lib/utils'

/** Marca: as três barras do ícone do app (ondas de som) e o nome em minúsculas. */
function Wordmark(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="4" y="9.5" width="3.6" height="5" rx="1.8" fill="currentColor" />
        <rect x="10.2" y="5" width="3.6" height="14" rx="1.8" fill="currentColor" />
        <rect x="16.4" y="7.5" width="3.6" height="9" rx="1.8" fill="currentColor" />
      </svg>
      <span className="text-[22px] leading-none font-semibold tracking-tight">auri</span>
    </div>
  )
}

function NavItem({
  to,
  icon,
  children
}: {
  to: string
  icon: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-night-soft transition-colors hover:bg-white/[0.07] hover:text-night-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]',
          // item ativo: preenchimento mais claro e texto branco (e aria-current, que o NavLink põe)
          isActive && 'bg-white/[0.12] text-night-ink hover:bg-white/[0.12]'
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

const SIDEBAR_WIDTH = 192

/** Onde fica o botão de recolher: logo depois dos botões da janela (Mac) ou no canto (Windows e web). */
const TOGGLE_LEFT = isMac ? 96 : 16
/** Lado do botão de recolher (`size-8`), em px. */
const TOGGLE_SIZE = 32
/** Espaço que o cabeçalho reserva à esquerda quando a barra está recolhida: botão da janela + botão. */
const HEADER_PAD_COLLAPSED = isMac ? 'pl-[148px]' : 'pl-[68px]'

/**
 * Botão de mostrar/ocultar a barra lateral. Fica sempre no mesmo lugar, ao lado dos botões da
 * janela, aberta ou recolhida a barra. Sobre o grafite é claro; solto sobre o conteúdo, com contorno.
 */
function SidebarToggle(): React.JSX.Element {
  const { open, toggle } = useSidebar()
  const label = open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'
  return (
    <Button
      variant={open ? 'night' : 'outline'}
      size="icon"
      className="no-drag"
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
          {/* faixa dos botões da janela e do botão de recolher (que fica por cima, ver abaixo) */}
          <div className="drag h-12 shrink-0" />
          <div className="px-3 pt-1 pb-5">
            <Wordmark />
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Principal">
            <NavItem to="/agenda" icon={<CalendarDays />}>
              Agenda
            </NavItem>
            <NavItem to="/pacientes" icon={<Users />}>
              Pacientes
            </NavItem>
          </nav>
          {/* mesmos px e gap dos itens do menu, para o ícone ficar na mesma coluna */}
          <p className="mt-auto flex items-center gap-2.5 px-3 text-xs leading-snug text-night-faint">
            <HardDrive className="size-[18px] shrink-0 stroke-[1.75]" aria-hidden="true" />
            Salvo neste computador
          </p>
        </aside>
        <div className="on-night absolute top-2 z-30" style={{ left: TOGGLE_LEFT }}>
          <SidebarToggle />
        </div>
        <main
          className="h-full min-w-0 overflow-hidden transition-[padding] duration-200 ease-out"
          style={{ paddingLeft: open ? SIDEBAR_WIDTH : 0 }}
        >
          <Outlet />
        </main>
      </div>
    </SidebarContext>
  )
}

type PageProps = {
  title: ReactNode
  /** Antes do título (ex.: botão Voltar) */
  lead?: ReactNode
  /** Selo ao lado do título (ex.: "Semana 41") */
  badge?: ReactNode
  /** Ação principal, no fim da linha */
  actions?: ReactNode
  /** Ferramentas da página (busca, filtros, navegação), antes da ação principal */
  toolbar?: ReactNode
  children: ReactNode
  bodyClassName?: string
}

/**
 * Página: uma barra de uma linha só (título à esquerda; ferramentas e ação principal à direita) e,
 * abaixo, o conteúdo, que rola sozinho. Um filete separa as duas partes quando o conteúdo rolou.
 * A barra é um contêiner (`@container`), então os itens podem se encolher conforme a largura
 * (ex.: `@min-[860px]:`); elementos `sticky top-0` do conteúdo (cabeçalho de tabela) param no topo
 * da área de rolagem, logo abaixo da barra.
 */
export function Page({
  title,
  lead,
  badge,
  actions,
  toolbar,
  children,
  bodyClassName
}: PageProps): React.JSX.Element {
  const { open } = useSidebar()
  const [scrolled, setScrolled] = useState(false)
  return (
    <div className="flex h-full flex-col">
      <header
        className={cn(
          '@container drag relative flex h-12 shrink-0 items-center gap-3 border-b px-6 transition-[padding,border-color] duration-200 ease-out',
          scrolled ? 'border-line' : 'border-transparent',
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
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          <h1 className="truncate text-xl leading-tight font-semibold tracking-tight first-letter:uppercase @max-[860px]:text-lg">
            {title}
          </h1>
          {badge}
        </div>
        <div className="no-drag ml-auto flex shrink-0 items-center gap-2">
          {toolbar}
          {actions}
        </div>
      </header>
      <div
        className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      >
        {children}
      </div>
    </div>
  )
}
