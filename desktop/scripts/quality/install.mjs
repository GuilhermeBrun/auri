import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execution, requireCondition, writeJson } from './evidence.mjs'

const startedAt = Date.now()
const directory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'auri-installer-quality-'))
let artifact
let mounted = false
const checks = []
mkdirSync('.quality/installer', { recursive: true })
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: 180_000, ...options })
  requireCondition(
    result.status === 0,
    `Falha no instalador: ${command} (${result.error?.message || result.status})`
  )
}

try {
  if (process.platform === 'win32') {
    requireCondition(
      process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_TEMP,
      'Instalar NSIS exige runner descartável do GitHub'
    )
    const installers = readdirSync('dist').filter((file) => file.endsWith('-setup.exe'))
    requireCondition(installers.length === 1, 'Esperado exatamente um instalador NSIS')
    artifact = resolve('dist', installers[0])
    const installDirectory = join(directory, 'app')
    run(artifact, ['/S', `/D=${installDirectory}`])
    requireCondition(
      existsSync(join(installDirectory, 'Auri.exe')),
      'NSIS não instalou o aplicativo no destino solicitado'
    )
    checks.push({ name: 'Instalador: NSIS instala o Auri em pasta temporária', status: 'passed' })
    run(process.execPath, ['scripts/quality/package.mjs'], {
      env: { ...process.env, AURI_PACKAGE_EXECUTABLE: join(installDirectory, 'Auri.exe') }
    })
  } else if (process.platform === 'darwin') {
    const images = readdirSync('dist').filter((file) => file.endsWith(`-${process.arch}.dmg`))
    requireCondition(images.length === 1, 'Esperada exatamente uma imagem DMG da arquitetura atual')
    artifact = resolve('dist', images[0])
    const mount = join(directory, 'volume')
    mkdirSync(mount)
    run('hdiutil', ['verify', artifact])
    run('hdiutil', ['attach', artifact, '-readonly', '-nobrowse', '-mountpoint', mount])
    mounted = true
    const app = join(mount, 'Auri.app')
    run('codesign', ['--verify', '--deep', '--strict', app])
    checks.push({
      name: 'Instalador: DMG íntegro e bundle com assinatura consistente',
      status: 'passed'
    })
    run(process.execPath, ['scripts/quality/package.mjs'], {
      env: { ...process.env, AURI_PACKAGE_EXECUTABLE: join(app, 'Contents/MacOS/Auri') }
    })
  } else {
    throw new Error('Distribuição do Auri suporta somente macOS e Windows')
  }
  checks.push({
    name: 'Instalador: aplicativo distribuído passa gravação, reabertura e banco histórico',
    status: 'passed'
  })
  copyFileSync('.quality/package/results.json', '.quality/installer/package-results.json')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (mounted) {
    const result = spawnSync('hdiutil', ['detach', join(directory, 'volume')], {
      stdio: 'inherit',
      timeout: 30_000
    })
    if (result.status !== 0) process.exitCode = 1
    else mounted = false
  }
  writeJson('.quality/installer/results.json', {
    ...execution(startedAt),
    success: !process.exitCode,
    artifact,
    sha256: artifact ? createHash('sha256').update(readFileSync(artifact)).digest('hex') : null,
    checks
  })
  if (!mounted) rmSync(directory, { recursive: true, force: true })
}
