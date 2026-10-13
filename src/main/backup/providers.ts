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
  readdir(path: string): Promise<string[]>
  /** Saída de `reg query <key> /s /v <value>` no Windows ('' se a chave não existir). */
  registry(key: string, value: string): Promise<string>
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

/** Estado a partir do que foi achado: pasta > sem permissão > instalado > nada. */
function settle(folder: string | null, blocked: boolean, installed: boolean): Found {
  if (folder) return { state: 'ready', folder }
  if (blocked) return { state: 'denied', folder: null }
  return { state: installed ? 'signed-out' : 'not-installed', folder: null }
}

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

async function macGoogle(probe: Probe): Promise<Found> {
  let blocked = false
  for (const account of await cloudStorage(probe, 'GoogleDrive-')) {
    try {
      const folder = await myDrive(probe, account)
      if (folder) return settle(folder, false, true)
    } catch (error) {
      blocked ||= denied(error)
    }
  }
  // versões antigas montavam um volume
  for (const name of MY_DRIVE) {
    const legacy = posix.join('/Volumes', 'GoogleDrive', name)
    if (await probe.exists(legacy)) return settle(legacy, false, true)
  }
  return settle(null, blocked, await probe.exists('/Applications/Google Drive.app'))
}

async function macOneDrive(probe: Probe): Promise<Found> {
  let blocked = false
  const accounts = await cloudStorage(probe, 'OneDrive')
  // a conta pessoal primeiro ("OneDrive-Personal"), depois as de empresa
  accounts.sort((a, b) => Number(b.endsWith('-Personal')) - Number(a.endsWith('-Personal')))
  for (const account of accounts) {
    try {
      await probe.readdir(account)
      return settle(account, false, true)
    } catch (error) {
      blocked ||= denied(error)
    }
  }
  const legacy = posix.join(probe.home, 'OneDrive')
  if (await probe.exists(legacy)) return settle(legacy, false, true)
  return settle(null, blocked, await probe.exists('/Applications/OneDrive.app'))
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

async function winOneDrive(probe: Probe): Promise<Found> {
  const accounts = parseRegistry(
    await probe.registry('HKCU\\Software\\Microsoft\\OneDrive\\Accounts', 'UserFolder'),
    'UserFolder'
  ).sort((a, b) => Number(/\\Personal$/i.test(b.key)) - Number(/\\Personal$/i.test(a.key)))
  const candidates = [
    ...accounts.map((a) => a.data),
    probe.env.OneDriveConsumer,
    probe.env.OneDrive
  ].filter((v): v is string => !!v)
  for (const folder of candidates) {
    if (await probe.exists(folder)) return settle(folder, false, true)
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
  return settle(null, false, installed)
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
  return settle(folder, false, installed)
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
    readdir: (path) => readdir(path),
    registry: (key, value) =>
      new Promise((resolve) =>
        execFile(
          'reg',
          ['query', key, '/s', '/v', value],
          { windowsHide: true, timeout: 5000 },
          (error, stdout) => resolve(error ? '' : stdout)
        )
      )
  }
}
