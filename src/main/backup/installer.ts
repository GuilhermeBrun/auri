import { execFile } from 'child_process'
import { app, net, shell, type IncomingMessage } from 'electron'
import { createWriteStream, existsSync } from 'fs'
import { copyFile, mkdir, readdir, rm } from 'fs/promises'
import { release } from 'os'
import { join, win32 } from 'path'
import { pipeline } from 'stream/promises'
import type { CloudProviderId, InstallProgress } from '../../shared/api'

type Installer = { url: string; file: string }

/** Instaladores oficiais (conferidos em 13/10/2026). O OneDrive passa por um redirecionamento. */
const INSTALLERS: Record<'google' | 'onedrive', Partial<Record<NodeJS.Platform, Installer>>> = {
  google: {
    darwin: {
      url: 'https://dl.google.com/drive-file-stream/GoogleDrive.dmg',
      file: 'GoogleDrive.dmg'
    },
    win32: {
      url: 'https://dl.google.com/drive-file-stream/GoogleDriveSetup.exe',
      file: 'GoogleDriveSetup.exe'
    }
  },
  onedrive: {
    darwin: { url: 'https://go.microsoft.com/fwlink/?linkid=823060', file: 'OneDrive.pkg' },
    win32: { url: 'https://go.microsoft.com/fwlink/?linkid=844652', file: 'OneDriveSetup.exe' }
  }
}

/** Página oficial, para baixar pelo navegador se o download daqui falhar. */
export const OFFICIAL_PAGE: Record<'google' | 'onedrive', string> = {
  google: 'https://www.google.com/drive/download/',
  onedrive: 'https://www.microsoft.com/microsoft-365/onedrive/download'
}

/** Só baixa destes endereços (depois dos redirecionamentos). */
const ALLOWED_HOSTS = ['dl.google.com', 'go.microsoft.com', 'oneclient.sfx.ms']

/** Quem tem de ter assinado o instalador. */
const PUBLISHER: Record<'google' | 'onedrive', string> = {
  google: 'Google LLC',
  onedrive: 'Microsoft Corporation'
}

function run(command: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  )
}

/** Pasta montada de um `hdiutil attach` (a última coluna da linha com /Volumes/). */
export function parseMountPoint(output: string): string | null {
  for (const line of output.split('\n')) {
    const at = line.indexOf('/Volumes/')
    if (at >= 0) return line.slice(at).trim()
  }
  return null
}

/** `pkgutil --check-signature`: assinado com certificado da Apple e pelo fabricante esperado. */
export function pkgSignedBy(output: string, publisher: string): boolean {
  return (
    /Status: signed by a developer certificate issued by Apple/i.test(output) &&
    output.includes(`Developer ID Installer: ${publisher} (`)
  )
}

/** Saída de `Get-AuthenticodeSignature` no formato "Status|Assunto do certificado". */
export function exeSignedBy(output: string, publisher: string): boolean {
  const [status, subject = ''] = output.trim().split('|')
  return status === 'Valid' && subject.includes(`O=${publisher}`)
}

async function verifyPkg(pkg: string, id: 'google' | 'onedrive'): Promise<void> {
  const output = await run('pkgutil', ['--check-signature', pkg]).catch(() => '')
  if (!pkgSignedBy(output, PUBLISHER[id])) throw new Error('unsigned')
}

async function verifyExe(exe: string, id: 'google' | 'onedrive'): Promise<void> {
  const script = `$s = Get-AuthenticodeSignature -LiteralPath '${exe.replace(/'/g, "''")}'; $s.Status.ToString() + '|' + $s.SignerCertificate.Subject`
  const output = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script
  ]).catch(() => '')
  if (!exeSignedBy(output, PUBLISHER[id])) throw new Error('unsigned')
}

/**
 * Pede o instalador, conferindo o domínio do endereço inicial e de cada redirecionamento (o
 * OneDrive passa por um). O `net.fetch` não serve: devolve a resposta final sem dizer de onde ela
 * veio. O `net.request` usa o proxy do sistema, como o resto do Electron.
 */
function request(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) {
      reject(new Error(`domínio ${new URL(url).hostname}`))
      return
    }
    const req = net.request({ url, redirect: 'manual' })
    req.on('redirect', (_status, _method, next) => {
      const host = new URL(next).hostname
      if (ALLOWED_HOSTS.includes(host)) req.followRedirect()
      else {
        req.abort()
        reject(new Error(`redirecionou para ${host}`))
      }
    })
    req.on('response', resolve)
    req.on('error', reject)
    req.end()
  })
}

/** Baixa avisando o andamento (0 a 1) a cada ponto percentual. */
async function download(
  installer: Installer,
  target: string,
  onProgress: (fraction: number | null) => void
): Promise<void> {
  const response = await request(installer.url)
  if (response.statusCode !== 200) throw new Error(`download ${response.statusCode}`)
  const total = Number(response.headers['content-length']) || null
  let received = 0
  let lastShown = -1
  if (!total) onProgress(null)
  response.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (!total) return
    const percent = Math.floor((received / total) * 100)
    if (percent !== lastShown) {
      lastShown = percent
      onProgress(received / total)
    }
  })
  // o IncomingMessage do Electron é um Readable, mas os tipos dele não dizem
  await pipeline(response as unknown as NodeJS.ReadableStream, createWriteStream(target))
}

/**
 * Mac: monta o .dmg sem abrir o Finder, copia o .pkg de dentro para `folder` e desmonta (para não
 * deixar o volume montado depois da instalação).
 */
async function pkgFromDmg(dmg: string, folder: string): Promise<string> {
  const mount = parseMountPoint(
    await run('hdiutil', ['attach', '-nobrowse', '-noautoopen', '-noverify', dmg])
  )
  if (!mount) throw new Error('mount')
  try {
    const pkg = (await readdir(mount)).find((name) => name.endsWith('.pkg'))
    if (!pkg) throw new Error('no pkg')
    const copy = join(folder, pkg)
    await rm(copy, { force: true })
    await copyFile(join(mount, pkg), copy)
    return copy
  } finally {
    await run('hdiutil', ['detach', mount, '-quiet']).catch(() => undefined)
  }
}

/**
 * Baixa o instalador oficial da nuvem, confere a assinatura (Google ou Microsoft) e o abre: no Mac
 * o Instalador do macOS, no Windows o instalador com o pedido de permissão do sistema. Daí em
 * diante é com o usuário; a tela percebe sozinha quando a pasta da nuvem aparece.
 */
export async function installProvider(
  id: CloudProviderId,
  onProgress: (progress: InstallProgress) => void
): Promise<void> {
  if (id === 'icloud') throw new Error('O iCloud Drive já vem com o macOS.')
  const installer = INSTALLERS[id][process.platform]
  if (!installer) throw new Error('Instalação automática indisponível neste sistema.')
  const name = id === 'google' ? 'Google Drive' : 'OneDrive'
  const folder = join(app.getPath('temp'), 'auri-instaladores')
  const target = join(folder, installer.file)
  try {
    await mkdir(folder, { recursive: true })
    await rm(target, { force: true })
    onProgress({ id, stage: 'downloading', progress: 0 })
    await download(installer, target, (progress) =>
      onProgress({ id, stage: 'downloading', progress })
    )
    onProgress({ id, stage: 'opening', progress: null })
    if (process.platform === 'darwin') {
      const pkg = target.endsWith('.dmg') ? await pkgFromDmg(target, folder) : target
      // o .dmg já deu o que tinha: o pacote copiado basta
      if (pkg !== target) await rm(target, { force: true })
      await verifyPkg(pkg, id)
      const error = await shell.openPath(pkg)
      if (error) throw new Error(error)
    } else {
      await verifyExe(target, id)
      const error = await shell.openPath(target)
      if (error) throw new Error(error)
    }
    onProgress({ id, stage: 'waiting', progress: null })
  } catch (error) {
    console.error(`[instalar] ${id}: ${(error as Error).message}`)
    const message = `Não foi possível instalar o ${name} daqui. Baixe pelo site oficial e instale; o Auri percebe sozinho quando terminar.`
    onProgress({ id, stage: 'error', progress: null, error: message })
    throw new Error(message)
  }
}

/** macOS 13 em diante trocou as Preferências pelos Ajustes do Sistema (outro endereço). */
const modernMac = (): boolean => Number(release().split('.')[0]) >= 22

/**
 * Abre o que falta para a nuvem ficar pronta: o app (para entrar na conta), os Ajustes do iCloud
 * ou a permissão de Arquivos e Pastas do macOS.
 */
export async function openProvider(id: CloudProviderId, denied: boolean): Promise<void> {
  if (process.platform === 'darwin') {
    if (denied) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
      )
      return
    }
    if (id === 'icloud') {
      await shell.openExternal(
        modernMac()
          ? 'x-apple.systempreferences:com.apple.systempreferences.AppleIDSettings'
          : 'x-apple.systempreferences:com.apple.preferences.AppleIDPrefPane'
      )
      return
    }
    const path = id === 'google' ? '/Applications/Google Drive.app' : '/Applications/OneDrive.app'
    const error = await shell.openPath(path)
    if (error) throw new Error('Não foi possível abrir o app. Procure por ele no Launchpad.')
    return
  }
  const env = process.env
  const programs = env.ProgramFiles ?? 'C:\\Program Files'
  const candidates =
    id === 'google'
      ? [
          win32.join(programs, 'Google', 'Drive File Stream', 'launch.bat'),
          win32.join(
            env.ProgramData ?? 'C:\\ProgramData',
            'Microsoft',
            'Windows',
            'Start Menu',
            'Programs',
            'Google Drive.lnk'
          )
        ]
      : [
          win32.join(env.LOCALAPPDATA ?? '', 'Microsoft', 'OneDrive', 'OneDrive.exe'),
          win32.join(programs, 'Microsoft OneDrive', 'OneDrive.exe')
        ]
  const found = candidates.find((path) => existsSync(path))
  if (!found || (await shell.openPath(found))) {
    throw new Error('Não foi possível abrir o app. Procure por ele no menu Iniciar.')
  }
}
