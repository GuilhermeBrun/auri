import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPrefsStore } from './prefs'

let file: string

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), 'auri-prefs-')), 'preferencias.json')
})

describe('preferências da interface', () => {
  it('começa com a barra lateral aberta e lembra a escolha na próxima abertura', () => {
    expect(createPrefsStore(file).get()).toEqual({ sidebarOpen: true })
    createPrefsStore(file).save({ sidebarOpen: false })
    expect(createPrefsStore(file).get()).toEqual({ sidebarOpen: false })
  })

  it('usa o padrão quando o arquivo está corrompido', () => {
    writeFileSync(file, '{ quebrado')
    expect(createPrefsStore(file).get()).toEqual({ sidebarOpen: true })
  })

  it('recusa valores inválidos sem mexer no que estava salvo', () => {
    const store = createPrefsStore(file)
    store.save({ sidebarOpen: false })
    expect(() => store.save({ sidebarOpen: 'não' })).toThrow()
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ sidebarOpen: false })
  })
})
