import { app, BrowserWindow, dialog, session, shell, type SaveDialogOptions } from 'electron'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import fontFile from '../../resources/fonts/bricolage-grotesque.woff2?asset'
import { PAGE_FOOTER } from './document'

const allowed = new Set<string>()
let pdfSession: Electron.Session | null = null

function isolatedSession(): Electron.Session {
  if (pdfSession) return pdfSession
  pdfSession = session.fromPartition('auri-pdf')
  pdfSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('data:') && !allowed.has(details.url) })
  })
  return pdfSession
}

let font: Promise<string> | null = null

export function documentFont(): Promise<string> {
  font ??= readFile(fontFile).then((data) => data.toString('base64'))
  return font
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const folder = await mkdtemp(join(app.getPath('temp'), 'auri-pdf-'))
  const file = join(folder, 'documento.html')
  const url = pathToFileURL(file).href
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, session: isolatedSession() }
  })
  allowed.add(url)
  try {
    await writeFile(file, html, { mode: 0o600 })
    await window.loadURL(url)
    return await window.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: PAGE_FOOTER
    })
  } finally {
    allowed.delete(url)
    window.destroy()
    await rm(folder, { recursive: true, force: true })
  }
}

export async function openPdf(pdf: Buffer, name: string): Promise<void> {
  const folder = join(app.getPath('temp'), 'auri-pdf')
  await mkdir(folder, { recursive: true })
  const now = Date.now()
  for (const old of await readdir(folder).catch(() => [])) {
    const path = join(folder, old)
    const info = await stat(path).catch(() => null)
    if (info && now - info.mtimeMs > 3_600_000) await rm(path, { force: true }).catch(() => {})
  }
  const file = join(folder, name)
  await writeFile(file, pdf, { mode: 0o600 })
  const error = await shell.openPath(file)
  if (error) throw new Error(`Não foi possível abrir o PDF: ${error}`)
}

export async function savePdf(pdf: Buffer, name: string): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const options: SaveDialogOptions = {
    title: 'Salvar PDF',
    buttonLabel: 'Salvar',
    defaultPath: join(app.getPath('documents'), name),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  }
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, pdf)
  void shell.openPath(result.filePath)
  return result.filePath
}
