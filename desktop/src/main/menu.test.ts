import { describe, expect, it, vi } from 'vite-plus/test'
import { macMenu } from './menu'

describe('menu do Mac', () => {
  it('Configurações… fica no menu do app, com ⌘ vírgula', () => {
    const openSettings = vi.fn()
    const [app] = macMenu('Auri', openSettings)
    const itens = app.submenu as Electron.MenuItemConstructorOptions[]
    const configuracoes = itens.find((item) => item.label === 'Configurações…')!
    expect(app.label).toBe('Auri')
    expect(itens.indexOf(configuracoes)).toBe(2)
    expect(configuracoes.accelerator).toBe('Command+,')
    configuracoes.click?.({} as never, undefined, {} as never)
    expect(openSettings).toHaveBeenCalledOnce()
  })

  it('mantém Editar para copiar e colar nos campos', () => {
    const editar = macMenu('Auri', () => {}).find((menu) => menu.label === 'Editar')!
    const papeis = (editar.submenu as Electron.MenuItemConstructorOptions[]).map((i) => i.role)
    expect(papeis).toEqual(
      expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])
    )
  })
})
