import {
  Building2,
  CalendarDays,
  MessageCircle,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import {
  arrangeSidebar,
  DEFAULT_SIDEBAR_ITEMS,
  type ArrangedItem,
  type SidebarItemId,
  type SidebarItems
} from '@shared/sidebar'
import { useReception } from '@renderer/lib/reception'
import { useWhatsAppEnabled } from '@renderer/lib/whatsapp'

type SidebarState = { open: boolean; toggle: () => void }

export const SidebarContext = createContext<SidebarState>({ open: true, toggle: () => {} })

export function useSidebar(): SidebarState {
  return useContext(SidebarContext)
}

export const SIDEBAR_ICONS: Record<SidebarItemId, LucideIcon> = {
  agenda: CalendarDays,
  pacientes: Users,
  financeiro: Wallet,
  clinica: Building2,
  whatsapp: MessageCircle
}

export const NAV_ITEM_HEIGHT = 34
export const NAV_GAP = 6

export const navItemClass =
  'relative flex h-[34px] items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-fill hover:text-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]'

let items: SidebarItems = window.prefs.initial?.sidebarItems ?? DEFAULT_SIDEBAR_ITEMS
let watching = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (!watching) {
    watching = true
    window.prefs.onChange((prefs) => {
      if (JSON.stringify(prefs.sidebarItems) === JSON.stringify(items)) return
      items = prefs.sidebarItems
      notify()
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSidebarItems(): SidebarItems {
  return useSyncExternalStore(subscribe, () => items)
}

export function saveSidebarItems(next: SidebarItems): void {
  items = next
  window.prefs.save({ sidebarItems: next })
  notify()
}

export function useAvailableItems(): ArrangedItem[] {
  const prefs = useSidebarItems()
  const reception = useReception()
  const whatsapp = useWhatsAppEnabled()
  return useMemo(
    () =>
      arrangeSidebar(prefs).filter(
        (item) => !(reception && item.id === 'clinica') && !(!whatsapp && item.id === 'whatsapp')
      ),
    [prefs, reception, whatsapp]
  )
}

export function useHomePath(): string {
  return useAvailableItems().find((item) => !item.hidden)?.path ?? '/agenda'
}
