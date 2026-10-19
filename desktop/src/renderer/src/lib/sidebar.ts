import { createContext, useContext } from 'react'

type SidebarState = { open: boolean; toggle: () => void }

export const SidebarContext = createContext<SidebarState>({ open: true, toggle: () => {} })

export function useSidebar(): SidebarState {
  return useContext(SidebarContext)
}
