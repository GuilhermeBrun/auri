import {
  Building2,
  CalendarDays,
  MessageCircle,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import { createContext, useContext, useMemo } from 'react'
import {
  arrangeSidebar,
  visibleItems,
  type ArrangedItem,
  type SidebarItemId,
  type SidebarItems
} from '@shared/sidebar'
import { prefsField, usePrefsField } from '@renderer/lib/prefs-field'
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

const sidebarItems = prefsField('sidebarItems')

export function useSidebarItems(): SidebarItems {
  return usePrefsField(sidebarItems)
}

export function saveSidebarItems(next: SidebarItems): void {
  sidebarItems.set(next)
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

export function useWhatsAppActive(): boolean {
  const enabled = useWhatsAppEnabled()
  const prefs = useSidebarItems()
  return enabled && !prefs.hidden.includes('whatsapp')
}

export function useVisibleItems(): ArrangedItem[] {
  const available = useAvailableItems()
  return useMemo(() => visibleItems(available), [available])
}

export function useHomePath(): string {
  return useVisibleItems().at(0)?.path ?? '/agenda'
}
