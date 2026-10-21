import { _electron as electron, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electronPath from 'electron'
import { listPackage } from '@electron/asar'
import { execution, sha256, writeJson } from './evidence.mjs'

const startedAt = Date.now()
const directory = mkdtempSync(join(tmpdir(), 'auri-package-quality-'))
const checks = []
let application
let packageExecutable = null
let asarSha256 = null
mkdirSync('.quality/package', { recursive: true })

function executable() {
  if (process.env.AURI_PACKAGE_EXECUTABLE) return resolve(process.env.AURI_PACKAGE_EXECUTABLE)
  if (process.platform === 'win32') return resolve('dist/win-unpacked/Auri.exe')
  const folders = readdirSync('dist')
  const folder = folders.includes(`mac-${process.arch}`)
    ? `mac-${process.arch}`
    : folders.includes('mac')
      ? 'mac'
      : null
  if (!folder) throw new Error('Pacote macOS não encontrado; execute npm run build:unpack')
  return resolve('dist', folder, 'Auri.app/Contents/MacOS/Auri')
}

async function check(name, fn) {
  try {
    await fn()
    checks.push({ name, status: 'passed' })
    console.log(`✓ ${name}`)
  } catch (error) {
    checks.push({ name, status: 'failed', detail: error.message })
    throw error
  }
}

const isAppWindow = (window) => window.url().startsWith('file:')

async function appWindow() {
  await expect.poll(() => application.windows().some(isAppWindow), { timeout: 30_000 }).toBe(true)
  return application.windows().find(isAppWindow)
}

async function launch(data) {
  mkdirSync(data, { recursive: true })
  const env = { ...process.env, TZ: 'America/Cuiaba', AURI_ERROS_URL: '' }
  delete env.ELECTRON_RUN_AS_NODE
  application = await electron.launch({
    executablePath: executable(),
    args: [`--user-data-dir=${data}`],
    env,
    timeout: 45_000
  })
  const page = await appWindow()
  expect(realpathSync(await application.evaluate(({ app }) => app.getPath('userData')))).toBe(
    realpathSync(data)
  )
  await expect(page.locator('main')).toBeVisible()
  const main = await application.evaluate(({ app, BrowserWindow }) => ({
    appPath: app.getAppPath(),
    userData: app.getPath('userData'),
    url: BrowserWindow.getAllWindows()[0].webContents.getURL(),
    runtime: process.versions
  }))
  const bridge = await page.evaluate(async () => ({
    url: location.href,
    backup: await window.backup.info().catch((error) => ({ error: error.message })),
    patients: await window.api.patients
      .list()
      .then((patients) => ({ count: patients.length }))
      .catch((error) => ({ error: error.message }))
  }))
  writeJson('.quality/package/startup.json', { main, bridge })
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
  })
  return page
}

try {
  await check('Pacote: contém apenas arquivos de execução e dependências de produção', async () => {
    const exe = executable()
    packageExecutable = exe
    const archive =
      process.platform === 'darwin'
        ? resolve(exe, '../../Resources/app.asar')
        : resolve(exe, '../resources/app.asar')
    expect(existsSync(archive)).toBe(true)
    const files = listPackage(archive).map((file) => file.replaceAll('\\', '/'))
    asarSha256 = sha256(readFileSync(archive))
    for (const file of [
      '/out/main/index.js',
      '/out/preload/index.js',
      '/out/renderer/index.html',
      '/package.json'
    ])
      expect(files).toContain(file)
    expect(
      files.filter(
        (file) =>
          /^\/(src|scripts|docs|\.quality|\.github)(\/|$)/.test(file) ||
          /^\/(vite|vitest|electron\.vite)\.config\./.test(file)
      )
    ).toEqual([])
    expect(files.some((file) => file.includes('node_modules/better-sqlite3/'))).toBe(true)
  })
  await check('Pacote: inicializa SQLite e mantém isolamento do renderer', async () => {
    const page = await launch(join(directory, 'novo'))
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
      return {
        contextIsolation: preferences.contextIsolation,
        nodeIntegration: preferences.nodeIntegration,
        sandbox: preferences.sandbox,
        webSecurity: preferences.webSecurity
      }
    })
    expect(preferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    })
    const continuar = page.getByRole('button', { name: 'Continuar', exact: true })
    await continuar.click()
    await continuar.click()
    await page.getByRole('button', { name: 'Começar do zero', exact: true }).click()
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await page.getByRole('button', { name: 'Novo paciente', exact: true }).click()
    await page.getByLabel('Nome completo', { exact: true }).fill('Paciente Pacote Fictício')
    await page.getByRole('button', { name: 'Cadastrar paciente', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'Paciente Pacote Fictício', exact: true })
    ).toBeVisible()
    await page.screenshot({ path: '.quality/package/primeira-gravacao.png' })
  })
  await check('Pacote: reabre os dados criados pelo aplicativo distribuído', async () => {
    await application.close()
    const page = await launch(join(directory, 'novo'))
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'Paciente Pacote Fictício', exact: true })
    ).toBeVisible()
    const patients = await page.evaluate(() => window.api.patients.list())
    expect(patients).toHaveLength(1)
    expect(patients[0].nome).toBe('Paciente Pacote Fictício')
    await application.close()
  })
  await check('Pacote: abre banco histórico sem perder paciente nem agendamento', async () => {
    const data = join(directory, 'historico')
    mkdirSync(data)
    const result = spawnSync(electronPath, ['scripts/quality/seed-db.mjs', join(data, 'auri.db')], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit'
    })
    expect(result.status).toBe(0)
    const page = await launch(data)
    await expect(
      page.getByRole('dialog', { name: 'Já usa o Auri?', exact: true })
    ).not.toBeVisible()
    const [patients, appointments] = await page.evaluate(async () => [
      await window.api.patients.list({ incluirInativos: true }),
      await window.api.appointments.listRange('2026-10-14T00:00', '2026-10-15T00:00')
    ])
    expect(patients).toEqual([
      expect.objectContaining({ id: 77, nome: 'João Histórico Fictício', ativo: false })
    ])
    expect(appointments).toEqual([
      expect.objectContaining({
        id: 88,
        patient_id: 77,
        inicio: '2026-10-14T14:00',
        fim: '2026-10-14T15:00',
        observacao: 'Fixture v1'
      })
    ])
  })
} catch (error) {
  console.error(error)
  process.exitCode = 1
  if (application) {
    const page = application.windows().find(isAppWindow)
    if (page && !page.isClosed())
      await page.screenshot({ path: '.quality/package/falha.png' }).catch(() => {})
  }
} finally {
  await application?.close().catch(() => {})
  writeJson('.quality/package/results.json', {
    ...execution(startedAt),
    success: !process.exitCode,
    executable: packageExecutable,
    asarSha256,
    checks
  })
  rmSync(directory, { recursive: true, force: true })
}
