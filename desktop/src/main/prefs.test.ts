import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPrefsStore } from './prefs'

let file: string

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), 'auri-prefs-')), 'preferencias.json')
})

describe('preferências da interface', () => {
  it('começa com a barra lateral aberta e o tema do sistema, e lembra a escolha na próxima abertura', () => {
    expect(createPrefsStore(file).get()).toEqual({
      sidebarOpen: true,
      theme: 'system',
      whatsapp: true,
      recepcao: false
    })
    createPrefsStore(file).save({ sidebarOpen: false })
    expect(createPrefsStore(file).get()).toEqual({
      sidebarOpen: false,
      theme: 'system',
      whatsapp: true,
      recepcao: false
    })
  })

  it('grava só o que mudou, sem perder o resto', () => {
    const store = createPrefsStore(file)
    store.save({ sidebarOpen: false })
    store.save({ theme: 'dark' })
    expect(createPrefsStore(file).get()).toEqual({
      sidebarOpen: false,
      theme: 'dark',
      whatsapp: true,
      recepcao: false
    })
  })

  it('completa com o padrão um arquivo de uma versão anterior, sem o tema', () => {
    writeFileSync(file, JSON.stringify({ sidebarOpen: false }))
    expect(createPrefsStore(file).get()).toEqual({
      sidebarOpen: false,
      theme: 'system',
      whatsapp: true,
      recepcao: false
    })
  })

  it('avisa a mudança só quando algo muda', () => {
    const onChange = vi.fn()
    const store = createPrefsStore(file, onChange)
    store.save({ theme: 'light' })
    store.save({ theme: 'light' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      sidebarOpen: true,
      theme: 'light',
      whatsapp: true,
      recepcao: false
    })
  })

  it('usa o padrão quando o arquivo está corrompido', () => {
    writeFileSync(file, '{ quebrado')
    expect(createPrefsStore(file).get()).toEqual({
      sidebarOpen: true,
      theme: 'system',
      whatsapp: true,
      recepcao: false
    })
  })

  it('recusa valores inválidos sem mexer no que estava salvo', () => {
    const store = createPrefsStore(file)
    store.save({ sidebarOpen: false })
    expect(() => store.save({ sidebarOpen: 'não' })).toThrow()
    expect(() => store.save({ theme: 'sépia' })).toThrow()
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      sidebarOpen: false,
      theme: 'system',
      whatsapp: true,
      recepcao: false
    })
  })
})
