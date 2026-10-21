export const SIDEBAR_ITEMS = [
  { id: 'agenda', label: 'Agenda', path: '/agenda' },
  { id: 'pacientes', label: 'Pacientes', path: '/pacientes' },
  { id: 'financeiro', label: 'Financeiro', path: '/financeiro' },
  { id: 'clinica', label: 'Clínica', path: '/clinica' },
  { id: 'whatsapp', label: 'WhatsApp', path: '/whatsapp' }
] as const

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number]

export type SidebarItemId = SidebarItem['id']

export type SidebarItems = { order: string[]; hidden: string[] }

export const DEFAULT_SIDEBAR_ITEMS: SidebarItems = { order: [], hidden: [] }

export type ArrangedItem = SidebarItem & { hidden: boolean }

export function arrangeSidebar(prefs: SidebarItems): ArrangedItem[] {
  const known = (id: string): SidebarItem | undefined => SIDEBAR_ITEMS.find((i) => i.id === id)
  const ordered = [...new Set(prefs.order)].flatMap((id) => known(id) ?? [])
  const rest = SIDEBAR_ITEMS.filter((item) => !ordered.includes(item))
  return [...ordered, ...rest].map((item) => ({ ...item, hidden: prefs.hidden.includes(item.id) }))
}

export function isDefaultSidebar(prefs: SidebarItems): boolean {
  const order = arrangeSidebar(prefs).map((item) => item.id)
  return (
    order.every((id, i) => id === SIDEBAR_ITEMS[i].id) &&
    !SIDEBAR_ITEMS.some((item) => prefs.hidden.includes(item.id))
  )
}

export function describeSidebar(prefs: SidebarItems): string {
  return arrangeSidebar(prefs)
    .filter((item) => !item.hidden)
    .map((item) => item.label)
    .join(', ')
}
