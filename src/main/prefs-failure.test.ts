import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, vi } from 'vite-plus/test'
import { createPrefsStore } from './prefs'

it('falha ao salvar preferências preserva memória e permite tentar novamente', () => {
  const directory = mkdtempSync(join(tmpdir(), 'auri-prefs-failure-'))
  try {
    const changed = vi.fn()
    const store = createPrefsStore(join(directory, 'ausente', 'prefs.json'), changed)
    const before = store.get()
    expect(() => store.save({ theme: 'dark' })).toThrow()
    expect(store.get()).toEqual(before)
    expect(changed).not.toHaveBeenCalled()
    mkdirSync(join(directory, 'ausente'))
    store.save({ theme: 'dark' })
    expect(store.get().theme).toBe('dark')
    expect(changed).toHaveBeenCalledExactlyOnceWith({ ...before, theme: 'dark' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
