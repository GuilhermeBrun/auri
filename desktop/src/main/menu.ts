import type { MenuItemConstructorOptions } from 'electron'

export function macMenu(name: string, openSettings: () => void): MenuItemConstructorOptions[] {
  return [
    {
      label: name,
      submenu: [
        { role: 'about', label: `Sobre o ${name}` },
        { type: 'separator' },
        { label: 'Configurações…', accelerator: 'Command+,', click: openSettings },
        { type: 'separator' },
        { role: 'services', label: 'Serviços' },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${name}` },
        { role: 'hideOthers', label: 'Ocultar os outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: `Sair do ${name}` }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'pasteAndMatchStyle', label: 'Colar sem formatação' },
        { role: 'selectAll', label: 'Selecionar tudo' }
      ]
    },
    {
      label: 'Janela',
      role: 'window',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Ampliar' },
        { role: 'close', label: 'Fechar janela' },
        { type: 'separator' },
        { role: 'front', label: 'Trazer tudo para a frente' }
      ]
    }
  ]
}
