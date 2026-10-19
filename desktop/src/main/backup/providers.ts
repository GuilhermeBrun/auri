import { execFile } from 'child_process'
import { access, readdir } from 'fs/promises'
import { homedir } from 'os'
import { posix, win32 } from 'path'
import type { CloudProvider, CloudProviderId, CloudState } from '../../shared/api'

export type Probe = {
  platform: NodeJS.Platform
  home: string
  env: Record<string, string | undefined>
  exists(path: string): Promise<boolean>
  readdir(this: void, path: string): Promise<string[]>
  registry(key: string, value?: string): Promise<string>
}

export const PROVIDER_NAMES: Record<CloudProviderId, string> = {
  google: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive'
}

const MY_DRIVE = ['Meu Drive', 'My Drive', 'Mi unidad', 'Mon Drive', 'Meine Ablage']
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

type Access = { blocked: boolean; closed: boolean }

function settle(folder: string | null, access: Access, installed: boolean): Found {
  if (folder) return { state: 'ready', folder }
  if (!installed) return { state: 'not-installed', folder: null }
  if (access.blocked) return { state: 'denied', folder: null }
  if (access.closed) return { state: 'closed', folder: null }
  return { state: 'signed-out', folder: null }
}

function note(access: Access, error: unknown): void {
  if (denied(error)) access.blocked = true
  else access.closed = true
}

const OK: Access = { blocked: false, closed: false }

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

async function myDrive(probe: Probe, account: string): Promise<string | null> {
  const names = await probe.readdir(account)
  const known = MY_DRIVE.find((name) => names.includes(name))
  const guess = names.find((name) => !name.startsWith('.') && !NOT_MY_DRIVE.includes(name))
  const chosen = known ?? guess
  return chosen ? posix.join(account, chosen) : null
}

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
      await probe.readdir(folder)
      return settle(folder, OK, true)
    } catch (error) {
      note(access, error)
    }
  }
  for (const name of MY_DRIVE) {
    const legacy = posix.join('/Volumes', 'GoogleDrive', name)
    if (await probe.exists(legacy)) return settle(legacy, OK, true)
  }
  return settle(null, access, await macApp(probe, 'Google Drive.app'))
}

async function macOneDrive(probe: Probe): Promise<Found> {
  const access: Access = { blocked: false, closed: false }
  const accounts = await cloudStorage(probe, 'OneDrive')
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
    return { state: denied(error) ? 'denied' : 'off', folder: null }
  }
}

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

async function winOneDrive(probe: Probe): Promise<Found> {
  const registry = parseRegistryValues(
    await probe.registry('HKCU\\Software\\Microsoft\\OneDrive\\Accounts')
  )
  const accounts = [...registry]
    .filter(([, values]) => values.get('UserFolder') && values.get('UserEmail'))
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

const DRIVE_LETTERS = 'GHIJKLMNOPQRSTUVWXYZDEF'.split('')

async function winGoogle(probe: Probe): Promise<Found> {
  const candidates = [
    ...DRIVE_LETTERS.flatMap((letter) => MY_DRIVE.map((name) => `${letter}:\\${name}`)),
    ...MY_DRIVE.map((name) => win32.join(probe.home, name))
  ]
  const hits = await Promise.all(candidates.map((c) => probe.exists(c)))
  const folder = candidates.find((_, i) => hits[i]) ?? null
  const programs = probe.env.ProgramFiles ?? 'C:\\Program Files'
  const installed = await probe.exists(win32.join(programs, 'Google', 'Drive File Stream'))
  return settle(folder, OK, installed)
}

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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

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
