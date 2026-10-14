import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execution, writeJson } from './evidence.mjs'
import { requireCondition } from './checks.mjs'

const startedAt = Date.now()
const version = '1.180.0'
const executable = process.env.AURI_SEMGREP || 'semgrep'
const config =
  process.env.AURI_SAST_POLICY ||
  fileURLToPath(new URL('../../docs/qualidade/sast.json', import.meta.url))
const rules = JSON.parse(readFileSync(config, 'utf8')).rules
const output = resolve('.quality/sast')
const work = mkdtempSync(join(tmpdir(), 'auri-sast-'))
const report = {
  ...execution(startedAt),
  success: false,
  version,
  policyHash: createHash('sha256').update(readFileSync(config)).digest('hex'),
  rules: rules.map((rule) => rule.id),
  fixtures: [],
  files: /** @type {string[]} */ ([])
}

function scan(targets, file) {
  const result = spawnSync(
    executable,
    [
      'scan',
      '--config',
      config,
      '--strict',
      '--error',
      '--disable-nosem',
      '--metrics=off',
      '--disable-version-check',
      '--no-rewrite-rule-ids',
      '--no-git-ignore',
      '--json',
      ...targets
    ],
    { encoding: 'utf8', timeout: 180_000, maxBuffer: 20 * 1024 * 1024 }
  )
  writeFileSync(file, result.stdout || '{}')
  writeFileSync(file + '.log', result.stderr || '')
  requireCondition(
    !result.error && [0, 1].includes(result.status),
    'Semgrep indisponível ou falhou'
  )
  const evidence = JSON.parse(result.stdout)
  requireCondition(
    Array.isArray(evidence.results) && evidence.errors?.length === 0,
    'SAST contém erro, timeout ou relatório inválido'
  )
  return evidence
}

try {
  writeJson(join(output, 'results.json'), report)
  const installed = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, SEMGREP_ENABLE_VERSION_CHECK: '0' }
  })
  requireCondition(
    installed.status === 0 && installed.stdout.trim() === version,
    `SAST exige semgrep==${version}; instale no ambiente Python ou defina AURI_SEMGREP`
  )
  requireCondition(
    rules.length > 0 && new Set(report.rules).size === rules.length,
    'Regras SAST vazias/duplicadas'
  )
  for (const rule of rules) {
    requireCondition(rule.metadata?.safe && rule.metadata?.unsafe, `Regra sem exemplos: ${rule.id}`)
    writeFileSync(join(work, `${rule.id}-unsafe.tsx`), rule.metadata.unsafe)
    writeFileSync(join(work, `${rule.id}-safe.tsx`), rule.metadata.safe)
  }
  const fixtures = scan([work], join(output, 'fixtures.json'))
  for (const rule of rules) {
    const unsafe = fixtures.results.filter(
      (finding) => finding.check_id === rule.id && finding.path.endsWith(`${rule.id}-unsafe.tsx`)
    )
    requireCondition(unsafe.length === 1, `Regra não detectou o exemplo inseguro: ${rule.id}`)
    report.fixtures.push({ id: rule.id, unsafeDetected: true, safeAccepted: true })
  }
  requireCondition(
    fixtures.results.length === rules.length &&
      !fixtures.results.some((finding) => finding.path.endsWith('-safe.tsx')),
    'SAST reprovou um exemplo seguro ou produziu achados inesperados'
  )
  report.files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter((file) => /^src\/.+\.[jt]sx?$/.test(file) && !/\.(test|d)\.[jt]sx?$/.test(file))
    .sort()
  requireCondition(report.files.length > 0, 'SAST sem fontes de produção')
  const evidence = scan(report.files, join(output, 'scan.json'))
  const scanned = new Set(evidence.paths?.scanned?.map((file) => file.replaceAll('\\', '/')))
  for (const file of report.files) requireCondition(scanned.has(file), `SAST omitiu fonte: ${file}`)
  requireCondition(
    evidence.results.length === 0,
    'SAST encontrou padrões inseguros; confira .quality/sast/scan.json'
  )
  report.success = true
  console.log(`SAST: ${rules.length} regras verificadas; ${scanned.size} fontes sem achados.`)
} catch (error) {
  report.error = error.message
  console.error(error.message)
  process.exitCode = 1
} finally {
  writeJson(join(output, 'results.json'), { ...report, ...execution(startedAt) })
  rmSync(work, { recursive: true, force: true })
}
