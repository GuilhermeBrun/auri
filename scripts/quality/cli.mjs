import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  requireCondition,
  validateTests,
  validateE2e,
  validateScenarios,
  validateAudit,
  validateJobs,
  validateCiExecution,
  validatePolicyChanges,
  parseNameStatus,
  policyFiles,
  packagingChanged
} from './checks.mjs'
import { MUTATION_PLATFORMS, validateExtendedBundle } from './extended-checks.mjs'
import { collectChangedLines, sha256, validateSast } from './risk-checks.mjs'

const trusted = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const show = (ref, file) =>
  execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const sha = () => process.env.EXPECTED_SHA || git('rev-parse', 'HEAD')
const write = (file, value) => {
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
const catalog = () => json(join(trusted, 'docs/qualidade/cenarios.json'))
const inventory = () => json(join(trusted, 'docs/qualidade/testes.json'))

async function reviewedSha() {
  const { PR_NUMBER, PR_HEAD_SHA, GITHUB_REPOSITORY, GH_TOKEN } = process.env
  if (!PR_NUMBER) return false
  requireCondition(PR_HEAD_SHA && GITHUB_REPOSITORY && GH_TOKEN, 'Contexto de revisão incompleto.')
  const get = async (suffix) => {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/${suffix}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000)
    })
    requireCondition(response.ok, `Não foi possível conferir revisão: HTTP ${response.status}.`)
    return response.json()
  }
  // A aprovação fica vinculada ao commit; um novo push invalida o comentário anterior.
  for (let page = 1; page <= 10; page++) {
    const reviews = await get(`pulls/${PR_NUMBER}/reviews?per_page=100&page=${page}`)
    for (const review of reviews) {
      if (
        review.body?.trim() !== `quality-policy-reviewed: ${PR_HEAD_SHA}` ||
        review.commit_id !== PR_HEAD_SHA ||
        !['COMMENTED', 'APPROVED'].includes(review.state)
      )
        continue
      const permission = await get(
        `collaborators/${encodeURIComponent(review.user.login)}/permission`
      )
      if (['admin', 'maintain', 'write'].includes(permission.permission)) return true
    }
    if (reviews.length < 100) break
  }
  return false
}

async function policy() {
  const base = process.env.BASE_SHA || git('rev-parse', 'HEAD')
  const knownBase = base && !/^0+$/.test(base)
  requireCondition(
    knownBase &&
      spawnSync('git', ['cat-file', '-e', `${base}:docs/qualidade/testes.json`]).status === 0,
    'Base aprovada indisponível; bootstrap automático desativado.'
  )
  const bootstrap = false
  const changed = knownBase
    ? parseNameStatus(
        git('-c', 'core.quotePath=false', 'diff', '--name-status', '--no-renames', base, '--')
      )
    : []
  const local = git('ls-files', '--others', '--exclude-standard')
    .split('\n')
    .filter(Boolean)
    .map((file) => ({ status: 'A', file }))
  const reviewed = process.env.GITHUB_EVENT_NAME !== 'pull_request' || (await reviewedSha())
  const entries = [...changed, ...local]
  const sensitive = validatePolicyChanges(
    // Só o manifesto e os JSON de política são comparados por conteúdo.
    policyFiles(entries, ({ status, file }) =>
      file === 'package.json' || /^docs\/qualidade\/[^/]+\.json$/.test(file)
        ? {
            before: status === 'A' ? null : show(base, file),
            after: status === 'D' ? null : readFileSync(file, 'utf8')
          }
        : {}
    ),
    reviewed,
    bootstrap
  )
  const docsChanged = entries.some(({ file }) => file.startsWith('docs/qualidade/'))
  const docsReviewed = reviewed || !sensitive.some((file) => file.startsWith('docs/qualidade/'))
  if (docsChanged && docsReviewed && trusted !== process.cwd()) {
    // Expectativas só entram no lugar das da base revisadas, ou quando apenas acrescentam
    // (teste, cenário, mutação ou arquivo de cobertura novo): nunca afrouxam a base.
    cpSync(resolve('docs/qualidade'), join(trusted, 'docs/qualidade'), { recursive: true })
  }
  requireCondition(
    inventory().tests.length > 0 && catalog().scenarios.length > 0,
    'Política vazia.'
  )
  const report = {
    success: true,
    sha: sha(),
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    base: base || null,
    bootstrap,
    reviewed,
    sensitive,
    packaging: packagingChanged(
      entries.map(({ file }) => file),
      process.env.GITHUB_EVENT_NAME === 'pull_request'
    ),
    changedCoverage: collectChangedLines(base)
  }
  write('.quality/policy.json', report)
  // O workflow pula o que esta política não vai exigir (ver quality.yml).
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `packaging=${report.packaging}\nmutation=${MUTATION_PLATFORMS.join(',')}\n`
    )
  console.log(
    bootstrap
      ? 'Política: adoção inicial; conferir revisão antes de integrar.'
      : 'Política: aprovada.'
  )
}

function validateBundle(
  directory,
  platform,
  changedCoverage = collectChangedLines(process.env.BASE_SHA),
  packaging = true
) {
  const run = json(join(directory, 'test-run.json'))
  const report = json(join(directory, 'tests.json'))
  const e2eReport = json(join(directory, 'e2e/results.json'))
  if (process.env.GITHUB_RUN_ID) {
    for (const evidence of [run, e2eReport]) {
      validateCiExecution(evidence, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
    }
  }
  const junit = readFileSync(join(directory, 'junit.xml'), 'utf8')
  requireCondition(
    junit.includes('<testcase') && !junit.includes('<failure'),
    'JUnit vazio/reprovado.'
  )
  const tests = validateTests(report, run, inventory(), sha(), platform)
  const e2e = validateE2e(e2eReport, sha(), platform)
  requireCondition(
    e2eReport.startedAt >= run.startedAt,
    'E2E antigo em relação à execução de testes.'
  )
  return {
    platform,
    tests: tests.size,
    scenarios: validateScenarios(catalog(), tests, e2e),
    ...validateExtendedBundle(directory, trusted, sha(), platform, changedCoverage, {
      packaging,
      mutation: MUTATION_PLATFORMS.includes(platform)
    })
  }
}

function validateSecurity(directory) {
  const report = json(join(directory, 'security.json'))
  requireCondition(
    report.success === true && report.sha === sha(),
    'Segurança ausente ou de outro SHA.'
  )
  if (process.env.GITHUB_RUN_ID)
    requireCondition(
      report.runId === process.env.GITHUB_RUN_ID &&
        report.runAttempt === process.env.GITHUB_RUN_ATTEMPT,
      'Segurança de outra execução/tentativa.'
    )
  validateAudit(json(join(directory, 'audit.json')))
  const secrets = json(join(directory, 'secrets.json'))
  requireCondition(
    Array.isArray(secrets) && secrets.length === 0,
    'Segredos encontrados ou relatório inválido.'
  )
  const rulesFile = join(trusted, 'docs/qualidade/sast.json')
  validateSast(
    json(join(directory, 'sast/results.json')),
    json(join(directory, 'sast/scan.json')),
    json(join(directory, 'sast/fixtures.json')),
    json(rulesFile).rules,
    sha256(readFileSync(rulesFile)),
    json(join(trusted, 'docs/qualidade/cobertura.json')).productionFiles,
    sha()
  )
}

function aggregate(directory) {
  validateJobs(JSON.parse(process.env.QUALITY_JOBS || '{}'))
  const policyReport = json(join(directory, 'quality-policy/policy.json'))
  requireCondition(
    policyReport.success && policyReport.sha === sha(),
    'Política ausente ou de outro SHA.'
  )
  if (process.env.GITHUB_RUN_ID)
    requireCondition(
      policyReport.runId === process.env.GITHUB_RUN_ID &&
        policyReport.runAttempt === process.env.GITHUB_RUN_ATTEMPT,
      'Política de outra execução/tentativa.'
    )
  const bundles = ['darwin', 'win32'].map((platform) =>
    validateBundle(
      join(directory, `quality-${platform}`),
      platform,
      policyReport.changedCoverage,
      policyReport.packaging !== false
    )
  )
  validateSecurity(join(directory, 'quality-security'))
  write(join(directory, 'summary.json'), { success: true, sha: sha(), bundles })
  console.log('quality: política, Windows, macOS, cenários e segurança aprovados.')
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  requireCondition(result.status === 0, `Comando reprovado: ${command} ${args.join(' ')}`)
}

async function local() {
  rmSync('.quality', { recursive: true, force: true })
  for (const script of [
    'check',
    'test:quality',
    'test:ci',
    'test:coverage-changed',
    'build',
    'test:performance',
    'test:e2e',
    'test:ui',
    'test:mutation',
    'build:unpack',
    'test:package',
    'quality:delivery',
    'security:check',
    'security:sast'
  ]) {
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script])
  }
  const summary = validateBundle('.quality', process.platform)
  validateSecurity('.quality')
  write('.quality/summary.json', { success: true, sha: sha(), ...summary })
  console.log('Qualidade local: aprovada. Proteção de merge depende do GitHub.')
}

try {
  const command = process.argv[2]
  if (command === 'policy') await policy()
  else if (command === 'validate') {
    const directory = process.argv[3] || '.quality'
    const summary = validateBundle(directory, process.platform)
    validateSecurity(directory)
    console.log(summary)
  } else if (command === 'aggregate') aggregate(process.argv[3])
  else if (command === 'audit') validateAudit(json(process.argv[3]))
  else if (command === 'local') await local()
  else throw new Error(`Comando desconhecido: ${command}`)
} catch (error) {
  console.error(`Qualidade reprovada: ${error.message}`)
  process.exitCode = 1
}
