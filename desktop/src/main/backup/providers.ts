import { execFile } from 'child_process'
import { access, readdir } from 'fs/promises'
import { homedir } from 'os'
import { posix, win32 } from 'path'
import type { CloudProvider, CloudProviderId, CloudState } from '../../shared/api'

/**
 * O que a detecção precisa do sistema. Separado para os testes simularem Mac e Windows; no app
 * vem de `systemProbe` (ver backup-service.ts).
 */
export type Probe = {
  platform: NodeJS.Platform
  home: string
  env: Record<string, string | undefined>
  /** O caminho existe. Nunca lança (unidade de rede fora do ar vira false). */
  exists(path: string): Promise<boolean>
  /** Lista uma pasta; lança com `code` (ENOENT, EPERM…) como o `fs`. */
  readdir(this: void, path: string): Promise<string[]>
  /**
   * Saída de `reg query <key> /s` no Windows, só do valor `value` quando informado ('' se a chave
   * não existir).
   */
  registry(key: string, value?: string): Promise<string>
}

export const PROVIDER_NAMES: Record<CloudProviderId, string> = {
  google: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive'
}

/** Nome da pasta principal do Google Drive conforme o idioma da conta. */
const MY_DRIVE = ['Meu Drive', 'My Drive', 'Mi unidad', 'Mon Drive', 'Meine Ablage']
/** Outras pastas que o Google Drive põe ao lado do "Meu Drive". */
const NOT_MY_DRIVE = [
  'Shared drives',
  'Drives compartilhados',
  'Other computers',
  'Outros computadores',
  'Computers',
  'Computadores'
]

type Found = { state: CloudState; folder: string | null }

const denied = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EPERM' || code === 'EACCES'
}

/** Como a pasta de uma conta respondeu: abriu, o macOS bloqueou ou não respondeu (app fechado). */
type Access = { blocked: boolean; closed: boolean }

/**
 * Estado a partir do que foi achado: pasta que abre > app não instalado > sem permissão > fechado
 * > falta entrar na conta. Desinstalar o app deixa a pasta da conta para trás (sem responder):
 * sem o app, vale "não instalado".
 */
function settle(folder: string | null, access: Access, installed: boolean): Found {
  if (folder) return { state: 'ready', folder }
  if (!installed) return { state: 'not-installed', folder: null }
  if (access.blocked) return { state: 'denied', folder: null }
  if (access.closed) return { state: 'closed', folder: null }
  return { state: 'signed-out', folder: null }
}

/**
 * Anota por que uma pasta da nuvem não abriu. Com o app da nuvem fechado, a pasta continua lá,
 * mas não responde (ETIMEDOUT): visto no Google Drive de verdade, em 13/10/2026.
 */
function note(access: Access, error: unknown): void {
  if (denied(error)) access.blocked = true
  else access.closed = true
}

const OK: Access = { blocked: false, closed: false }

/** Pastas de `~/Library/CloudStorage` que começam com `prefix` (uma por conta). */
async function cloudStorage(probe: Probe, prefix: string): Promise<string[]> {
  const root = posix.join(probe.home, 'Library', 'CloudStorage')
  try {
    return (await probe.readdir(root))
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => posix.join(root, name))
  } catch {
    return []
  }
}

/** "Meu Drive" dentro da pasta de uma conta do Google Drive. */
async function myDrive(probe: Probe, account: string): Promise<string | null> {
  const names = await probe.readdir(account)
  const known = MY_DRIVE.find((name) => names.includes(name))
  const guess = names.find((name) => !name.startsWith('.') && !NOT_MY_DRIVE.includes(name))
  const chosen = known ?? guess
  return chosen ? posix.join(account, chosen) : null
}

/** O app está em /Applications ou na pasta Aplicativos do usuário. */
async function macApp(probe: Probe, name: string): Promise<boolean> {
  const places = ['/Applications', posix.join(probe.home, 'Applications')]
  return (await Promise.all(places.map((p) => probe.exists(posix.join(p, name))))).some(Boolean)
}

async function macGoogle(probe: Probe): Promise<Found> {
  const access: Access = { blocked: false, closed: false }
  for (const account of await cloudStorage(probe, 'GoogleDrive-')) {
    try {
      const folder = await myDrive(probe, account)
      if (!folder) continue
      // o "Meu Drive" tem de abrir de verdade, não só aparecer na lista
      await probe.readdir(folder)
      return settle(folder, OK, true)
    } catch (error) {
      note(access, error)
    }
  }
  // versões antigas montavam um volume
  for (const name of MY_DRIVE) {
    const legacy = posix.join('/Volumes', 'GoogleDrive', name)
    if (await probe.exists(legacy)) return settle(legacy, OK, true)
  }
  return settle(null, access, await macApp(probe, 'Google Drive.app'))
}

async function macOneDrive(probe: Probe): Promise<Found> {
  const access: Access = { blocked: false, closed: false }
  const accounts = await cloudStorage(probe, 'OneDrive')
  // a conta pessoal primeiro ("OneDrive-Personal"), depois as de empresa
  accounts.sort((a, b) => Number(b.endsWith('-Personal')) - Number(a.endsWith('-Personal')))
  for (const account of accounts) {
    try {
      await probe.readdir(account)
      return settle(account, OK, true)
    } catch (error) {
      note(access, error)
    }
  }
  const legacy = posix.join(probe.home, 'OneDrive')
  if (await probe.exists(legacy)) return settle(legacy, OK, true)
  return settle(null, access, await macApp(probe, 'OneDrive.app'))
}

async function macICloud(probe: Probe): Promise<Found> {
  const folder = posix.join(probe.home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
  try {
    await probe.readdir(folder)
    return { state: 'ready', folder }
  } catch (error) {
    // vem com o macOS: sem a pasta, está desligado nos Ajustes
    return { state: denied(error) ? 'denied' : 'off', folder: null }
  }
}

/** Blocos de `reg query /s`: chave → valor, para preferir a conta pessoal do OneDrive. */
export function parseRegistry(output: string, value: string): { key: string; data: string }[] {
  const found: { key: string; data: string }[] = []
  let key = ''
  for (const line of output.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) key = line.trim()
    const match = new RegExp(`^\\s+${value}\\s+REG_(?:EXPAND_)?SZ\\s+(.+?)\\s*$`, 'i').exec(line)
    if (match) found.push({ key, data: match[1] })
  }
  return found
}

/** Valores de cada chave numa saída de `reg query /s`: chave → nome → dado. */
export function parseRegistryValues(output: string): Map<string, Map<string, string>> {
  const keys = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null
  for (const line of output.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      current = new Map()
      keys.set(line.trim(), current)
      continue
    }
    const match = /^\s+(\S+)\s+REG_\w+\s+(.*?)\s*$/.exec(line)
    if (match && current) current.set(match[1], match[2])
  }
  return keys
}

/**
 * OneDrive no Windows: pronto só com uma conta conectada (com e-mail no registro) e a pasta
 * dela no disco. O instalador cria a pasta antes do login (visto no CI em 14/10/2026), e copiar
 * ali gravaria numa pasta que não sobe para lugar nenhum.
 */
async function winOneDrive(probe: Probe): Promise<Found> {
  const registry = parseRegistryValues(
    await probe.registry('HKCU\\Software\\Microsoft\\OneDrive\\Accounts')
  )
  const accounts = [...registry]
    .filter(([, values]) => values.get('UserFolder') && values.get('UserEmail'))
    // a conta pessoal primeiro, depois as de empresa
    .sort(([a], [b]) => Number(/\\Personal$/i.test(b)) - Number(/\\Personal$/i.test(a)))
  for (const [, values] of accounts) {
    const folder = values.get('UserFolder')!
    if (await probe.exists(folder)) return settle(folder, OK, true)
  }
  const local = probe.env.LOCALAPPDATA ?? win32.join(probe.home, 'AppData', 'Local')
  const programs = [probe.env.ProgramFiles, probe.env['ProgramFiles(x86)']].filter(
    (v): v is string => !!v
  )
  const executables = [
    win32.join(local, 'Microsoft', 'OneDrive', 'OneDrive.exe'),
    ...programs.map((p) => win32.join(p, 'Microsoft OneDrive', 'OneDrive.exe'))
  ]
  const installed = (await Promise.all(executables.map((e) => probe.exists(e)))).some(Boolean)
  return settle(null, OK, installed)
}

/** Letras de unidade em que o Google Drive costuma montar (G: é o padrão). */
const DRIVE_LETTERS = 'GHIJKLMNOPQRSTUVWXYZDEF'.split('')

async function winGoogle(probe: Probe): Promise<Found> {
  const candidates = [
    ...DRIVE_LETTERS.flatMap((letter) => MY_DRIVE.map((name) => `${letter}:\\${name}`)),
    // modo "espelhar arquivos": uma pasta comum dentro do usuário
    ...MY_DRIVE.map((name) => win32.join(probe.home, name))
  ]
  const hits = await Promise.all(candidates.map((c) => probe.exists(c)))
  const folder = candidates.find((_, i) => hits[i]) ?? null
  const programs = probe.env.ProgramFiles ?? 'C:\\Program Files'
  const installed = await probe.exists(win32.join(programs, 'Google', 'Drive File Stream'))
  return settle(folder, OK, installed)
}

/**
 * Google Drive, OneDrive e (só no Mac) iCloud Drive, com a situação de cada um e a pasta, pelo
 * que o app de cada nuvem cria no computador. Nada de API nem login: se a pasta existe, as cópias
 * gravadas nela sobem sozinhas.
 */
export async function detectProviders(probe: Probe): Promise<CloudProvider[]> {
  const make = (id: CloudProviderId, found: Found): CloudProvider => ({
    id,
    name: PROVIDER_NAMES[id],
    ...found
  })
  if (probe.platform === 'darwin') {
    const [icloud, google, onedrive] = await Promise.all([
      macICloud(probe),
      macGoogle(probe),
      macOneDrive(probe)
    ])
    return [make('google', google), make('onedrive', onedrive), make('icloud', icloud)]
  }
  if (probe.platform === 'win32') {
    const [google, onedrive] = await Promise.all([winGoogle(probe), winOneDrive(probe)])
    return [make('google', google), make('onedrive', onedrive)]
  }
  return []
}

/** Espera no máximo `ms`: uma unidade de rede fora do ar pode travar o `access` por segundos. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

/** O sistema de verdade, para `detectProviders`. */
export function systemProbe(): Probe {
  return {
    platform: process.platform,
    home: homedir(),
    env: process.env,
    exists: (path) =>
      withTimeout(
        access(path).then(
          () => true,
          () => false
        ),
        1500,
        false
      ),
    // a pasta de uma nuvem com o app travado pode não responder: desiste em 3 s
    readdir: (path) =>
      Promise.race([
        readdir(path),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 3000)
        )
      ]),
    registry: (key, value) =>
      new Promise((resolve) =>
        execFile(
          'reg',
          ['query', key, '/s', ...(value ? ['/v', value] : [])],
          { windowsHide: true, timeout: 5000 },
          (error, stdout) => resolve(error ? '' : stdout)
        )
      )
  }
}
