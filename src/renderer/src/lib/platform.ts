export const isMac = window.platform === 'darwin'

/** Tecla modificadora do sistema: ⌘ no Mac, Ctrl no Windows. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

/** Atalho de mostrar/ocultar a barra lateral: o padrão do macOS é ⌃⌘S. */
export const SIDEBAR_SHORTCUT = isMac ? '⌃⌘S' : 'Ctrl+B'
