import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron')
const out = process.argv[2] ?? join(tmpdir(), 'auri-e2e-saida')
mkdirSync(out, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'auri-e2e-'))
const cloud = join(work, 'nuvem')
const PAGE_PORT = 9350
const MAIN_PORT = 9250

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const startedAt = Date.now()
const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, status: ok ? 'passed' : 'failed', detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = spawn(
  electron,
  [
    `--inspect=${MAIN_PORT}`,
    '.',
    `--user-data-dir=${join(work, 'dados')}`,
    `--remote-debugging-port=${PAGE_PORT}`
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] }
)
app.stdout.on('data', (d) => process.stdout.write(`[app] ${d}`))
app.stderr.on('data', (d) => process.stdout.write(`[app] ${d}`))

async function connect(port, type) {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const target = targets.find((t) => t.type === type && !t.url.startsWith('devtools'))
      if (target) {
        const ws = new WebSocket(target.webSocketDebuggerUrl)
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve)
          ws.addEventListener('error', reject)
        })
        let id = 0
        const pending = new Map()
        ws.addEventListener('message', (e) => {
          const m = JSON.parse(e.data)
          if (m.id && pending.has(m.id)) {
            pending.get(m.id)(m)
            pending.delete(m.id)
          }
        })
        const send = (method, params = {}) =>
          new Promise((resolve) => {
            const i = ++id
            pending.set(i, resolve)
            ws.send(JSON.stringify({ id: i, method, params }))
          })
        return {
          ws,
          send,
          async eval(expression) {
            const res = await send('Runtime.evaluate', {
              expression,
              awaitPromise: true,
              returnByValue: true,
              includeCommandLineAPI: true
            })
            if (res.result?.exceptionDetails) {
              throw new Error(res.result.exceptionDetails.exception?.description ?? 'erro')
            }
            return res.result?.result?.value
          }
        }
      }
    } catch {}
    await sleep(1000)
  }
  throw new Error(`não conectou na porta ${port}`)
}

async function shot(page, name) {
  await sleep(700)
  const res = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${name}.png`), Buffer.from(res.result.data, 'base64'))
}

function desktopShot(name) {
  if (process.platform !== 'win32') return
  const file = join(out, `${name}.png`).replace(/'/g, "''")
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
    '$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
    `$bmp.Save('${file}')`
  ].join('; ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script])
  } catch (error) {
    console.log(`(sem captura da tela: ${error.message.split('\n')[0]})`)
  }
}

function acceptGoogleInstaller(seconds) {
  if (process.platform !== 'win32') return false
  const script = `
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);
}
"@
$root = [System.Windows.Automation.AutomationElement]::RootElement
$byName = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Google Drive')
function Find { $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $byName) }
for ($i = 0; $i -lt ${seconds}; $i++) {
  $w = Find
  if ($w) {
    $h = [IntPtr]$w.Current.NativeWindowHandle
    [Win]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Seconds 5
    $w = Find
    if ($w) {
      $r = $w.Current.BoundingRectangle
      $x = [int]($r.Left + $r.Width * 0.432); $y = [int]($r.Top + $r.Height * 0.913)
      [Win]::SetCursorPos($x, $y) | Out-Null
      [Win]::mouse_event(2, 0, 0, 0, 0); [Win]::mouse_event(4, 0, 0, 0, 0)
      Start-Sleep -Seconds 5
      'clicou na posicao'
    } else { 'enter' }
    exit 0
  }
  Start-Sleep -Seconds 1
}
'nao achou'
`
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath')
  )
  const powershell = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  try {
    const result = execFileSync(powershell, ['-NoProfile', '-Command', script], {
      env,
      encoding: 'utf8'
    }).trim()
    console.log(`(instalador do Google: ${result})`)
    return result !== 'nao achou'
  } catch (error) {
    console.log(`(automação de interface falhou: ${error.message.split('\n')[0]})`)
    return false
  }
}

const FIELDS =
  'nome,data_nascimento,cpf,escola,serie,professora,mae_nome,mae_cpf,mae_rg,mae_celular,mae_email,mae_profissao,pai_nome,pai_profissao,endereco,bairro,cidade,indicacao,pediatra,data_entrada,observacoes'

async function run() {
  const page = await connect(PAGE_PORT, 'page')
  const main = await connect(MAIN_PORT, 'node')
  await page.eval(
    `new Promise((r) => document.readyState === 'complete' ? r() : addEventListener('load', r))`
  )
  await sleep(2000)
  console.log(`plataforma: ${await page.eval('window.platform')}`)

  const welcome = await page.eval(`document.body.textContent.includes('Boas-vindas ao Auri')`)
  check('primeira abertura mostra a introdução', welcome)
  await shot(page, '01-boas-vindas')
  for (let i = 0; i < 2; i++) {
    await page.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continuar')?.click()`
    )
    await sleep(300)
  }
  check(
    'a introdução termina em "Já usa o Auri?"',
    await page.eval(`document.body.textContent.includes('Já usa o Auri?')`)
  )
  await page.eval(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Começar do zero')?.click()`
  )

  await main.eval(`(() => {
    const { dialog } = require('electron')
    globalThis.__open = null
    globalThis.__save = null
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [globalThis.__open] })
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: globalThis.__save })
    return true
  })()`)

  const count = await page.eval(`(async () => {
    const blank = Object.fromEntries('${FIELDS}'.split(',').map((f) => [f, '']))
    for (const nome of ['Ana Teste', 'Bruno Teste', 'Carla Teste']) {
      await window.api.patients.create({ ...blank, nome })
    }
    const p = await window.api.patients.list()
    await window.api.appointments.create({ patient_id: p[0].id, inicio: '2026-10-14T09:00', fim: '2026-10-14T09:30', observacao: '' })
    return p.length
  })()`)
  check('cadastra pacientes fictícios', count === 3)

  const providers = await page.eval(`window.backup.providers()`)
  console.log(`nuvens: ${providers.map((p) => `${p.id}=${p.state}`).join(', ')}`)
  check('detecta as nuvens do sistema', providers.length >= 2)
  await page.eval(`location.hash = '#/configuracoes/armazenamento?secao=copia'`)
  await sleep(3500)
  await shot(page, '02-assistente-nuvens')

  const code = await page.eval(`(async () => {
    const r = await window.backup.setup({ kind: 'folder', folder: ${JSON.stringify(cloud)} }, 'senha-boa-123')
    for (let i = 0; i < 40 && !(await window.backup.info()).lastSuccessAt; i++) await new Promise((r) => setTimeout(r, 250))
    return r.recoveryCode
  })()`)
  const copies = join(cloud, 'Auri', 'Cópias')
  const files = existsSync(copies) ? readdirSync(copies) : []
  check('liga a cópia e grava a primeira cópia cifrada', files.length === 1, files[0])
  await shot(page, '03-copia-ligada')

  const password = await page.eval(`(async () => {
    const r = {}
    try { await window.backup.changePassword('errada', 'outra-senha-1') } catch (e) { r.wrong = e.message }
    await window.backup.changePassword('senha-boa-123', 'outra-senha-1')
    try { await window.backup.resetPassword('AAAA', 'x-senha-nova') } catch (e) { r.badCode = e.message }
    await window.backup.resetPassword(${JSON.stringify(code)}.toLowerCase(), 'terceira-senha')
    return r
  })()`)
  check(
    'alterar senha e "esqueci a senha" (com o código)',
    password.wrong === 'Senha atual incorreta.' &&
      password.badCode === 'Código de recuperação incorreto.',
    JSON.stringify(password)
  )

  const restore = await page.eval(`(async () => {
    const blank = Object.fromEntries('${FIELDS}'.split(',').map((f) => [f, '']))
    await window.api.patients.create({ ...blank, nome: 'Depois Teste' })
    const before = (await window.api.patients.list()).length
    const [copy] = await window.backup.list()
    await window.backup.restore(copy.file)
    const after = (await window.api.patients.list()).length
    await window.backup.undoRestore()
    const undone = (await window.api.patients.list()).length
    return { before, after, undone }
  })()`)
  check(
    'restaura a cópia e desfaz',
    restore.before === 4 && restore.after === 3 && restore.undone === 4,
    JSON.stringify(restore)
  )

  await main.eval(`globalThis.__open = ${JSON.stringify(join(copies, files[0] ?? 'x'))}`)
  const picked = await page.eval(
    `window.backup.pickFile().then((e) => e && { own: e.own, n: e.counts.patients })`
  )
  check('escolhe uma cópia pela janela de abrir', picked?.own === true && picked.n === 3)

  const settingsFile = join(work, 'Auri - configurações.auriconfig')
  await main.eval(`globalThis.__save = ${JSON.stringify(settingsFile)}`)
  await page.eval(`(async () => {
    window.prefs.save({ theme: 'dark' })
    await new Promise((r) => setTimeout(r, 300))
    await window.connection.setName('Recepção')
    return window.transfer.exportSettings()
  })()`)
  check('exporta as configurações', existsSync(settingsFile))
  await page.eval(`(async () => {
    window.prefs.save({ theme: 'light' })
    await new Promise((r) => setTimeout(r, 300))
    await window.connection.setName('Outro nome')
  })()`)
  await main.eval(`globalThis.__open = ${JSON.stringify(settingsFile)}`)
  const preview = await page.eval(`window.transfer.pickSettings()`)
  check(
    'importar mostra o que muda',
    preview?.changes.some((c) => c.label === 'Tema' && c.to === 'Escuro') &&
      preview.changes.some((c) => c.label === 'Nome deste computador' && c.to === 'Recepção'),
    JSON.stringify(preview?.changes)
  )
  await page.eval(`window.transfer.applySettings(${JSON.stringify(preview?.token)})`)
  const applied = await page.eval(`window.connection.info().then((i) => i.name)`)
  check('aplica as configurações importadas', applied === 'Recepção')
  await page.eval(`location.hash = '#/configuracoes/geral'`)
  await sleep(500)
  await shot(page, '04-geral-importar-exportar')
  await page.eval(`location.hash = '#/configuracoes/armazenamento'`)
  await sleep(1000)
  await shot(page, '05-armazenamento')
  await page.eval(`location.hash = '#/configuracoes/armazenamento?secao=copia'`)
  await sleep(1000)
  await shot(page, '06-armazenamento-copia')

  if (process.env.AURI_E2E_INSTALAR) {
    await page.eval(`window.backup.disable()`)
    await sleep(1500)
    const clicked = await page.eval(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Instalar')
      button?.click()
      return !!button
    })()`)
    check('clica em "Instalar" no cartão do Google Drive', clicked)
    const confirmed = acceptGoogleInstaller(300)
    check('a janela do instalador do Google aparece e aceita "Install"', confirmed)
    desktopShot('06-depois-do-install')
    let state = 'not-installed'
    const seen = []
    for (let i = 0; i < 60 && state === 'not-installed'; i++) {
      await sleep(5000)
      if (i === 2) await shot(page, '06-instalando')
      if (i % 6 === 3) desktopShot(`06-tela-${i}`)
      state = (await page.eval(`window.backup.providers()`)).find((p) => p.id === 'google').state
    }
    seen.push(state)
    check(
      'o Google Drive fica instalado (falta entrar na conta)',
      state === 'signed-out',
      seen.join(' → ')
    )
    await sleep(3000)
    await shot(page, '07-instalado')
    await page.eval(`window.backup.openProvider('google')`)
    await sleep(15000)
    desktopShot('08-google-drive-aberto')
    const running =
      process.platform === 'win32'
        ? execFileSync('tasklist', ['/FI', 'IMAGENAME eq GoogleDriveFS.exe'], { encoding: 'utf8' })
        : execFileSync('pgrep', ['-fl', 'Google Drive'], { encoding: 'utf8' }).toString()
    check('"Abrir o Google Drive" abre o app', /GoogleDriveFS|Google Drive/i.test(running))
    const screen = await page.eval(`document.body.textContent.includes('Abrir o Google Drive')`)
    check('o cartão oferece "Abrir o Google Drive"', screen)

    if (process.platform === 'win32') {
      const onedrive = async () =>
        (await page.eval(`window.backup.providers()`)).find((p) => p.id === 'onedrive').state
      let od = await onedrive()
      console.log(`OneDrive antes: ${od}`)
      if (od === 'not-installed') {
        const clickedOd = await page.eval(`(() => {
          const card = [...document.querySelectorAll('div')].find((d) => d.textContent.startsWith('OneDrive') && d.querySelector('button'))
          const button = [...(card?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'Instalar')
          button?.click()
          return !!button
        })()`)
        check('clica em "Instalar" no cartão do OneDrive', clickedOd)
        for (let i = 0; i < 60 && od === 'not-installed'; i++) {
          await sleep(5000)
          if (i === 6) desktopShot('09-onedrive-instalando')
          od = await onedrive()
        }
      }
      try {
        const reg = execFileSync(
          'reg',
          ['query', 'HKCU\\Software\\Microsoft\\OneDrive\\Accounts', '/s'],
          {
            encoding: 'utf8'
          }
        )
        console.log(`registro do OneDrive:\n${reg.replace(/(UserEmail\s+REG_SZ\s+)\S+/g, '$1***')}`)
      } catch {
        console.log('registro do OneDrive: (sem contas)')
      }
      check('o OneDrive fica instalado (falta entrar na conta)', od === 'signed-out', od)
      const running = (image) =>
        new RegExp(image.replace('.', '\\.'), 'i').test(
          execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`], { encoding: 'utf8' })
        )
      for (let i = 0; i < 40 && running('OneDriveSetup.exe'); i++) await sleep(3000)
      await page.eval(`window.backup.openProvider('onedrive')`)
      let odOpen = false
      for (let i = 0; i < 20 && !odOpen; i++) {
        await sleep(3000)
        odOpen = running('OneDrive.exe')
      }
      desktopShot('10-onedrive-aberto')
      if (!odOpen) {
        const lines = execFileSync('tasklist', { encoding: 'utf8' })
          .split('\n')
          .filter((line) => /onedrive/i.test(line))
        console.log(`processos do OneDrive:\n${lines.join('\n') || '(nenhum)'}`)
      }
      check('"Abrir o OneDrive" abre o app', odOpen)
      await shot(page, '11-cartoes-instalados')
    }
  }
}

try {
  await run()
} catch (error) {
  failures++
  checks.push({ name: 'execução do Electron', status: 'failed', detail: error.message })
  console.log(`✗ erro: ${error.stack ?? error}`)
} finally {
  app.kill()
  writeFileSync(
    join(out, 'results.json'),
    JSON.stringify(
      {
        sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        worktreeDirty:
          execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
        platform: process.platform,
        arch: process.arch,
        runId: process.env.GITHUB_RUN_ID || null,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
        startedAt,
        finishedAt: Date.now(),
        success: failures === 0,
        checks
      },
      null,
      2
    )
  )
}
console.log(failures === 0 ? '\nE2E: tudo certo' : `\nE2E: ${failures} falha(s)`)
process.exit(failures === 0 ? 0 : 1)
