import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireCondition, validateAudit } from './checks.mjs'

const version = '8.30.1'
const releases = {
  'linux-x64': [
    'linux_x64.tar.gz',
    '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'
  ],
  'darwin-arm64': [
    'darwin_arm64.tar.gz',
    'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'
  ],
  'darwin-x64': [
    'darwin_x64.tar.gz',
    'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'
  ],
  'win32-x64': [
    'windows_x64.zip',
    'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'
  ]
}
const out = '.quality'
mkdirSync(out, { recursive: true })
for (const file of ['audit.json', 'secrets.json', 'security.json'])
  rmSync(join(out, file), { force: true })
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const report = {
  sha,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  success: false,
  gitleaks: version
}
const work = mkdtempSync(join(tmpdir(), 'auri-quality-security-'))

try {
  const audit = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024
  })
  requireCondition(
    !audit.error && [0, 1].includes(audit.status),
    'Não foi possível executar npm audit.'
  )
  writeFileSync(join(out, 'audit.json'), audit.stdout)
  const auditReport = JSON.parse(audit.stdout)
  // A saída fica guardada mesmo quando o scanner ou o bloqueio falha.
  let auditError
  try {
    report.vulnerabilities = validateAudit(auditReport)
  } catch (error) {
    auditError = error
  }

  const release = releases[`${process.platform}-${process.arch}`]
  requireCondition(release, 'Plataforma sem binário Gitleaks validado.')
  const [suffix, digest] = release
  const response = await fetch(
    `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${suffix}`,
    { signal: AbortSignal.timeout(120_000) }
  )
  requireCondition(response.ok, `Download Gitleaks falhou: HTTP ${response.status}.`)
  const archive = Buffer.from(await response.arrayBuffer())
  requireCondition(
    createHash('sha256').update(archive).digest('hex') === digest,
    'Hash do Gitleaks não confere.'
  )
  const file = join(work, suffix)
  writeFileSync(file, archive)
  execFileSync('tar', ['-xf', file, '-C', work])
  const executable = join(work, process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks')
  const config = fileURLToPath(new URL('../../docs/qualidade/gitleaks.toml', import.meta.url))
  const args = [
    '--no-banner',
    '--redact=100',
    '--config',
    config,
    '--report-format',
    'json',
    '--report-path',
    resolve(out, 'secrets.json')
  ]

  if (process.env.CI === 'true') {
    // checkout fetch-depth: 0: todos os commits, não somente o último diff.
    args.push('git', '.')
  } else {
    // Inclui código local ainda não commitado sem ler arquivos pessoais ignorados pelo Git.
    const snapshot = join(work, 'source')
    mkdirSync(snapshot)
    const files = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { encoding: 'utf8' }
    )
      .split('\0')
      .filter(Boolean)
    for (const path of files) {
      if (
        /^(research_notes|reports|\.quality|node_modules|out|dist)\//.test(path) ||
        !existsSync(path)
      )
        continue
      const source = resolve(path)
      requireCondition(lstatSync(source).isFile(), `Arquivo não regular no scan: ${path}`)
      const target = join(snapshot, path)
      mkdirSync(resolve(target, '..'), { recursive: true })
      copyFileSync(source, target)
    }
    args.push('dir', snapshot)
  }
  const scan = spawnSync(executable, args, { stdio: 'inherit', timeout: 180_000 })
  requireCondition(
    !scan.error && scan.status === 0,
    'Scan de segredos falhou; confira o relatório redigido.'
  )
  const findings = JSON.parse(readFileSync(join(out, 'secrets.json'), 'utf8'))
  requireCondition(
    Array.isArray(findings) && findings.length === 0,
    'Scan de segredos não está limpo.'
  )
  if (auditError) throw auditError
  report.success = true
  console.log(
    `Segurança: nenhum segredo ou achado alto/crítico; ${report.vulnerabilities.moderate} moderado(s) registrado(s).`
  )
} catch (error) {
  report.error = error.message
  console.error(`Segurança reprovada: ${error.message}`)
  process.exitCode = 1
} finally {
  writeFileSync(join(out, 'security.json'), JSON.stringify(report, null, 2) + '\n')
  rmSync(work, { recursive: true, force: true })
}
