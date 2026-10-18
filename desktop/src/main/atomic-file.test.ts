import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { createPrefsStore } from './prefs'

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>()
  return { ...fs, renameSync: vi.fn(fs.renameSync), writeFileSync: vi.fn(fs.writeFileSync) }
})
const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs')
let directory: string
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'auri-atomic-'))
})
afterEach(() => {
  vi.clearAllMocks()
  rmSync(directory, { recursive: true, force: true })
})

it('preferências são gravadas completas e não deixam temporários', () => {
  const file = join(directory, 'prefs.json')
  const store = createPrefsStore(file)
  store.save({ theme: 'dark' })
  expect(createPrefsStore(file).get().theme).toBe('dark')
  expect(readdirSync(directory)).toEqual(['prefs.json'])
})

it('falha ao substituir preferências preserva arquivo, memória e notificações', () => {
  const file = join(directory, 'prefs.json')
  const changed = vi.fn()
  const store = createPrefsStore(file, changed)
  store.save({ theme: 'dark' })
  changed.mockClear()
  const before = readFileSync(file)
  const prefs = store.get()
  vi.mocked(renameSync).mockImplementationOnce(() => {
    throw Object.assign(new Error('Arquivo ocupado'), { code: 'EBUSY' })
  })
  expect(() => store.save({ theme: 'light' })).toThrow('Arquivo ocupado')
  expect(store.get()).toEqual(prefs)
  expect(readFileSync(file)).toEqual(before)
  expect(changed).not.toHaveBeenCalled()
  expect(readdirSync(directory)).toEqual(['prefs.json'])
  store.save({ theme: 'light' })
  expect(createPrefsStore(file).get().theme).toBe('light')
})

it('gravação parcial por falta de espaço não corrompe as preferências anteriores', () => {
  const file = join(directory, 'prefs.json')
  const store = createPrefsStore(file)
  store.save({ theme: 'dark' })
  const before = readFileSync(file)
  vi.mocked(writeFileSync).mockImplementationOnce((target) => {
    actualFs.writeFileSync(target, '{incompleto')
    throw Object.assign(new Error('Sem espaço'), { code: 'ENOSPC' })
  })
  expect(() => store.save({ theme: 'light' })).toThrow('Sem espaço')
  expect(readFileSync(file)).toEqual(before)
  expect(store.get().theme).toBe('dark')
  expect(readdirSync(directory)).toEqual(['prefs.json'])
})
