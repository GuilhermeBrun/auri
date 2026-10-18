export const isMac = window.platform === 'darwin'

/** Tecla modificadora do sistema: ⌘ no Mac, Ctrl no Windows. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

/** Atalho de mostrar/ocultar a barra lateral: o padrão do macOS é ⌃⌘S. */
export const SIDEBAR_SHORTCUT = isMac ? '⌃⌘S' : 'Ctrl+B'

/** Atalho das configurações: o padrão do macOS é ⌘, (e muitos apps de Windows usam Ctrl+,). */
export const SETTINGS_SHORTCUT = isMac ? '⌘,' : 'Ctrl+,'
