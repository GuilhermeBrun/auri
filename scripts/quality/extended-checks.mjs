import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { requireCondition, validateCiExecution, validateE2e } from './checks.mjs'

const json = (file) => JSON.parse(readFileSync(file, 'utf8'))

export function validateRelease(mainSha, sha, tag, version, runs) {
  requireCondition(
    tag === `v${version}`,
    'Tag de release precisa corresponder à versão do package.json'
  )
  requireCondition(mainSha === sha, 'Tag de release precisa apontar para o commit atual de main')
  requireCondition(
    runs.some(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === 'main' &&
        run.event === 'push' &&
        run.status === 'completed' &&
        run.conclusion === 'success'
    ),
    'Release exige Qualidade aprovado no push de main desse commit'
  )
}

export function validateCoverage(summary, policy, root) {
  const normalized = new Map(
    Object.entries(summary).map(([file, metrics]) => [
      file.replaceAll('\\', '/').replace(root.replaceAll('\\', '/') + '/', ''),
      metrics
    ])
  )
  for (const file of policy.productionFiles)
    requireCondition(normalized.has(file), `Cobertura omitiu arquivo de produção: ${file}`)
  for (const [file, minimums] of Object.entries({ total: policy.minimums, ...policy.critical })) {
    const measured = normalized.get(file)
    requireCondition(measured, `Cobertura ausente: ${file}`)
    for (const [metric, minimum] of Object.entries(minimums)) {
      const value = measured[metric]?.pct
      requireCondition(
        Number.isFinite(value) && value >= minimum,
        `Cobertura insuficiente em ${file}: ${metric} ${value}% < ${minimum}%`
      )
    }
  }
  return Object.fromEntries(
    Object.entries(summary.total)
      .filter(([metric]) => metric !== 'branchesTrue')
      .map(([metric, result]) => [metric, result.pct])
  )
}

export function validateExtendedReport(report, expected, sha, platform) {
  const collected = validateE2e(report, sha, platform)
  requireCondition(
    report.mode !== 'reference',
    'Geração de referências visuais não aprova qualidade'
  )
  for (const name of expected)
    requireCondition(collected.get(name) === 'passed', `Validação obrigatória ausente: ${name}`)
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  return collected.size
}

export function validateMutations(report, catalog, sha, platform) {
  requireCondition(
    report.success === true && report.sha === sha && report.platform === platform,
    'Mutação ausente, reprovada ou de outro commit/plataforma'
  )
  requireCondition(
    Number.isFinite(report.startedAt) && report.finishedAt >= report.startedAt,
    'Mutação sem horário válido'
  )
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  const actual = new Map(report.mutants.map((mutant) => [mutant.id, mutant]))
  requireCondition(
    actual.size === report.mutants.length &&
      actual.size === catalog.mutants.length &&
      actual.size > 0,
    'Inventário de mutação vazio, duplicado ou incompleto'
  )
  for (const mutant of catalog.mutants)
    requireCondition(
      actual.get(mutant.id)?.status === 'killed' &&
        actual.get(mutant.id)?.file === mutant.file &&
        actual.get(mutant.id)?.failedTests > 0,
      `Mutação não detectada: ${mutant.id}`
    )
  return actual.size
}

export function validateExtendedBundle(directory, trusted, sha, platform) {
  const policy = json(join(trusted, 'docs/qualidade/gates.json'))
  const run = json(join(directory, 'test-run.json'))
  return {
    coverage: validateCoverage(
      json(join(directory, 'coverage/coverage-summary.json')),
      json(join(trusted, 'docs/qualidade/cobertura.json')),
      run.root
    ),
    ui: validateExtendedReport(json(join(directory, 'ui/results.json')), policy.ui, sha, platform),
    package: validateExtendedReport(
      json(join(directory, 'package/results.json')),
      policy.package,
      sha,
      platform
    ),
    mutations: validateMutations(
      json(join(directory, 'mutation/results.json')),
      json(join(trusted, 'docs/qualidade/mutacoes.json')),
      sha,
      platform
    )
  }
}
