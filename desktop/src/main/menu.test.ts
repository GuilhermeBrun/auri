import { describe, expect, it, vi } from 'vite-plus/test'
import { paraAcelerador, teclasDosAtalhos } from '../shared/atalhos'
import { macMenu } from './menu'

describe('menu do Mac', () => {
  it('Configurações… fica no menu do app, com ⌘ vírgula', () => {
    const openSettings = vi.fn()
    const atalho = paraAcelerador(teclasDosAtalhos('mac', {}).configuracoes)
    const [app] = macMenu('Auri', openSettings, atalho)
    const itens = app.submenu as Electron.MenuItemConstructorOptions[]
    const configuracoes = itens.find((item) => item.label === 'Configurações…')!
    expect(app.label).toBe('Auri')
    expect(itens.indexOf(configuracoes)).toBe(2)
    expect(configuracoes.accelerator).toBe('Command+,')
    configuracoes.click?.({} as never, undefined, {} as never)
    expect(openSettings).toHaveBeenCalledOnce()
  })

  it('segue o atalho trocado pela pessoa, ou fica sem atalho', () => {
    const item = (atalhos: Record<string, string | null>): Electron.MenuItemConstructorOptions =>
      (
        macMenu('Auri', () => {}, paraAcelerador(teclasDosAtalhos('mac', atalhos).configuracoes))[0]
          .submenu as Electron.MenuItemConstructorOptions[]
      ).find((i) => i.label === 'Configurações…')!
    expect(item({ configuracoes: 'Shift+Meta+KeyP' }).accelerator).toBe('Shift+Command+P')
    expect(item({ configuracoes: null }).accelerator).toBeUndefined()
  })

  it('mantém Editar para copiar e colar nos campos', () => {
    const editar = macMenu('Auri', () => {}, undefined).find((menu) => menu.label === 'Editar')!
    const papeis = (editar.submenu as Electron.MenuItemConstructorOptions[]).map((i) => i.role)
    expect(papeis).toEqual(
      expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])
    )
  })
})
