import { createContext, useContext } from 'react'

type SidebarState = { open: boolean; toggle: () => void }

/** Estado da barra lateral (aberta ou recolhida), compartilhado entre ela e o cabeçalho da página. */
export const SidebarContext = createContext<SidebarState>({ open: true, toggle: () => {} })

export function useSidebar(): SidebarState {
  return useContext(SidebarContext)
}
