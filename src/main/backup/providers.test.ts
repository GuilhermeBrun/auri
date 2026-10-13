import { describe, expect, it } from 'vitest'
import { detectProviders, parseRegistry, systemProbe, type Probe } from './providers'

/**
 * Sistema de arquivos de mentira: cada caminho listado existe (as pastas-pai também). `blocked`
 * simula a pasta que o macOS não deixa abrir sem permissão.
 */
function fakeProbe(options: {
  platform: NodeJS.Platform
  home: string
  paths: string[]
  blocked?: string[]
  env?: Record<string, string>
  registry?: string
}): Probe {
  const sep = options.platform === 'win32' ? '\\' : '/'
  const all = new Set<string>()
  for (const path of options.paths) {
    const parts = path.split(sep)
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join(sep))
  }
  return {
    platform: options.platform,
    home: options.home,
    env: options.env ?? {},
    exists: async (path) => all.has(path),
    readdir: async (path) => {
      if (options.blocked?.includes(path)) {
        throw Object.assign(new Error('blocked'), { code: 'EPERM' })
      }
      if (!all.has(path)) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      const prefix = path + sep
      return [...all]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes(sep))
        .map((p) => p.slice(prefix.length))
    },
    registry: async () => options.registry ?? ''
  }
}

const HOME = '/Users/recepcao'
const STORAGE = `${HOME}/Library/CloudStorage`

describe('nuvens no Mac', () => {
  it('acha o Meu Drive, o OneDrive pessoal e o iCloud prontos', async () => {
    const probe = fakeProbe({
      platform: 'darwin',
      home: HOME,
      paths: [
        `${STORAGE}/GoogleDrive-clinica@exemplo.com/Meu Drive`,
        `${STORAGE}/GoogleDrive-clinica@exemplo.com/Outros computadores`,
        `${STORAGE}/OneDrive-Empresa/x`,
        `${STORAGE}/OneDrive-Personal/x`,
        `${HOME}/Library/Mobile Documents/com~apple~CloudDocs/x`
      ]
    })
    expect(await detectProviders(probe)).toEqual([
      {
        id: 'google',
        name: 'Google Drive',
        state: 'ready',
        folder: `${STORAGE}/GoogleDrive-clinica@exemplo.com/Meu Drive`
      },
      { id: 'onedrive', name: 'OneDrive', state: 'ready', folder: `${STORAGE}/OneDrive-Personal` },
      {
        id: 'icloud',
        name: 'iCloud Drive',
        state: 'ready',
        folder: `${HOME}/Library/Mobile Documents/com~apple~CloudDocs`
      }
    ])
  })

  it('instalado sem conta, não instalado e iCloud desligado', async () => {
    const probe = fakeProbe({
      platform: 'darwin',
      home: HOME,
      paths: ['/Applications/Google Drive.app', `${HOME}/Documents`]
    })
    const states = (await detectProviders(probe)).map((p) => [p.id, p.state, p.folder])
    expect(states).toEqual([
      ['google', 'signed-out', null],
      ['onedrive', 'not-installed', null],
      ['icloud', 'off', null]
    ])
  })

  it('pasta que o macOS não deixou abrir vira "sem permissão"', async () => {
    const account = `${STORAGE}/GoogleDrive-clinica@exemplo.com`
    const probe = fakeProbe({
      platform: 'darwin',
      home: HOME,
      paths: [`${account}/Meu Drive`, '/Applications/Google Drive.app'],
      blocked: [account]
    })
    expect((await detectProviders(probe))[0]).toMatchObject({ state: 'denied', folder: null })
  })
})

describe('nuvens no Windows', () => {
  const WIN_HOME = 'C:\\Users\\Recepcao'

  it('lê a pasta do OneDrive no registro (preferindo a pessoal) e acha o Google Drive no G:', async () => {
    const registry = [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\OneDrive\\Accounts\\Business1',
      '    UserFolder    REG_SZ    C:\\Users\\Recepcao\\OneDrive - Clinica',
      '',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\OneDrive\\Accounts\\Personal',
      '    UserFolder    REG_SZ    C:\\Users\\Recepcao\\OneDrive',
      ''
    ].join('\r\n')
    const probe = fakeProbe({
      platform: 'win32',
      home: WIN_HOME,
      paths: [
        'G:\\Meu Drive\\x',
        'C:\\Users\\Recepcao\\OneDrive\\x',
        'C:\\Users\\Recepcao\\OneDrive - Clinica\\x'
      ],
      registry
    })
    expect((await detectProviders(probe)).map((p) => [p.id, p.state, p.folder])).toEqual([
      ['google', 'ready', 'G:\\Meu Drive'],
      ['onedrive', 'ready', 'C:\\Users\\Recepcao\\OneDrive']
    ])
  })

  it('OneDrive que vem com o Windows, sem conta; Google Drive não instalado; sem iCloud', async () => {
    const probe = fakeProbe({
      platform: 'win32',
      home: WIN_HOME,
      paths: ['C:\\Users\\Recepcao\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe'],
      env: { LOCALAPPDATA: 'C:\\Users\\Recepcao\\AppData\\Local' }
    })
    expect((await detectProviders(probe)).map((p) => [p.id, p.state])).toEqual([
      ['google', 'not-installed'],
      ['onedrive', 'signed-out']
    ])
  })
})

// No sistema de verdade: só roda no Windows (no CI, em windows-latest).
describe.runIf(process.platform === 'win32')('Windows de verdade', () => {
  it('lê uma pasta do registro com reg.exe', async () => {
    const output = await systemProbe().registry(
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders',
      'Desktop'
    )
    const [desktop] = parseRegistry(output, 'Desktop')
    expect(desktop?.data).toMatch(/^[A-Z]:\\/i)
  })

  it('procura Google Drive e OneDrive sem travar nem lançar erro', async () => {
    const found = await detectProviders(systemProbe())
    expect(found.map((p) => p.id)).toEqual(['google', 'onedrive'])
    for (const provider of found) {
      expect(['ready', 'signed-out', 'not-installed']).toContain(provider.state)
      expect(provider.state === 'ready').toBe(provider.folder !== null)
    }
  }, 20_000)
})
