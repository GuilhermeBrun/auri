import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { requireCondition, validateCiExecution } from './checks.mjs'
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

export const productionFile = (file) =>
  /^src\/.+\.[jt]sx?$/.test(file) && !/\.(test|d)\.[jt]sx?$/.test(file)

export function parseChangedLines(diff) {
  const changes = new Map()
  let file
  let line = 0
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.startsWith('+++ b/') ? text.slice(6) : null
    } else if (text.startsWith('@@ ')) {
      const hunk = /\+(\d+)(?:,\d+)? @@/.exec(text)
      requireCondition(hunk, 'Hunk de diff inválido')
      line = Number(hunk[1])
    } else if (file && productionFile(file) && text.startsWith('+')) {
      if (!changes.has(file)) changes.set(file, new Set())
      changes.get(file).add(line++)
    } else if (text.startsWith(' ')) line++
  }
  return [...changes]
    .map(([file, lines]) => ({ file, lines: [...lines].sort((a, b) => a - b) }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function collectChangedLines(base) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  const reference = base || git('merge-base', 'HEAD', 'origin/main')
  requireCondition(/^[0-9a-f]{40}$/.test(reference), 'Base da cobertura diferencial inválida')
  const changes = parseChangedLines(
    git(
      '-c',
      'core.quotePath=false',
      'diff',
      '--no-ext-diff',
      '--no-color',
      '--no-renames',
      '--unified=0',
      reference,
      '--',
      'src'
    )
  )
  for (const file of git('ls-files', '--others', '--exclude-standard')
    .split('\n')
    .filter(productionFile))
    changes.push({
      file,
      lines: readFileSync(file, 'utf8')
        .split('\n')
        .map((_, index) => index + 1)
    })
  return { base: reference, changes: changes.sort((a, b) => a.file.localeCompare(b.file)) }
}

export function measureChangedCoverage(coverage, changes, root, minimum) {
  requireCondition(Number.isFinite(minimum) && minimum >= 0 && minimum <= 100, 'Mínimo inválido')
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '') + '/'
  const files = new Map(
    Object.entries(coverage).map(([file, value]) => [
      file.replaceAll('\\', '/').replace(normalizedRoot, ''),
      value
    ])
  )
  const lines = []
  const identities = new Set()
  for (const change of changes) {
    requireCondition(
      productionFile(change.file) && Array.isArray(change.lines),
      'Fonte de diff inválida'
    )
    const file = files.get(change.file)
    requireCondition(
      file?.statementMap && file.s,
      `Cobertura omitiu fonte alterada: ${change.file}`
    )
    const hits = new Map()
    for (const [id, location] of Object.entries(file.statementMap)) {
      requireCondition(
        Number.isFinite(file.s[id]) && file.s[id] >= 0,
        'Contador de cobertura inválido'
      )
      hits.set(location.start.line, Math.max(hits.get(location.start.line) || 0, file.s[id]))
    }
    for (const line of change.lines) {
      const identity = `${change.file}:${line}`
      requireCondition(
        Number.isInteger(line) && line > 0 && !identities.has(identity),
        'Linha inválida/duplicada'
      )
      identities.add(identity)
      if (hits.has(line)) lines.push({ file: change.file, line, hits: hits.get(line) })
    }
  }
  const covered = lines.filter((line) => line.hits > 0).length
  const pct = lines.length === 0 ? 100 : (covered / lines.length) * 100
  return { lines, covered, total: lines.length, pct, minimum, success: pct >= minimum }
}

export function validateChangedCoverage(report, coverage, expected, root, minimum, sha, platform) {
  requireCondition(
    report.sha === sha && report.platform === platform,
    'Diff de outro SHA/plataforma'
  )
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  requireCondition(report.base === expected.base, 'Diff de outra base')
  const measured = measureChangedCoverage(coverage, expected.changes, root, minimum)
  requireCondition(
    JSON.stringify(report.measurement) === JSON.stringify(measured),
    'Cobertura diferencial inconsistente'
  )
  requireCondition(measured.success, `Linhas alteradas: ${measured.pct.toFixed(2)}% < ${minimum}%`)
  return { lines: measured.total, pct: measured.pct }
}

export function validateSast(report, raw, fixtures, rules, policyHash, expectedFiles, sha) {
  requireCondition(
    report.success === true && report.sha === sha && report.version === '1.180.0',
    'SAST ausente ou de outra versão/SHA'
  )
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  const ids = rules.map((rule) => rule.id).sort()
  requireCondition(ids.length > 0 && new Set(ids).size === ids.length, 'Regras vazias/duplicadas')
  requireCondition(
    report.policyHash === policyHash &&
      JSON.stringify([...report.rules].sort(lexical)) === JSON.stringify(ids),
    'Política SAST divergente'
  )
  requireCondition(
    raw.version === report.version &&
      Array.isArray(raw.results) &&
      raw.results.length === 0 &&
      Array.isArray(raw.errors) &&
      raw.errors.length === 0,
    'SAST com achados ou erros'
  )
  requireCondition(
    fixtures.results?.length === ids.length && fixtures.errors?.length === 0,
    'SAST sem provas das regras'
  )
  for (const id of ids) {
    requireCondition(
      fixtures.results.filter(
        (finding) => finding.check_id === id && finding.path.endsWith(`${id}-unsafe.tsx`)
      ).length === 1,
      `Regra SAST não comprovada: ${id}`
    )
  }
  const scanned = raw.paths?.scanned?.map((file) => file.replaceAll('\\', '/')).sort()
  requireCondition(
    JSON.stringify(scanned) === JSON.stringify([...expectedFiles].sort(lexical)),
    'SAST omitiu fonte de produção'
  )
  return { rules: ids.length, files: scanned.length }
}

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function validatePerformance(report, policy, sha, platform) {
  requireCondition(
    report.success === true && report.sha === sha && report.platform === platform,
    'Performance ausente ou de outro SHA/plataforma'
  )
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  requireCondition(
    report.benchmark?.patients === policy.patients &&
      report.benchmark.samples === policy.samples &&
      report.benchmark.resultsVerified === true,
    'Benchmark vazio ou diferente da referência'
  )
  for (const [metric, maximum] of Object.entries(policy.maximums)) {
    const value = report.metrics?.[metric]
    requireCondition(
      Number.isFinite(value) && value > 0 && value <= maximum,
      `Regressão de performance: ${metric} ${value} > ${maximum}`
    )
  }
  requireCondition(
    report.assets?.length > 0 &&
      report.assets.every((asset) => asset.gzipBytes > 0 && /^[0-9a-f]{64}$/.test(asset.sha256)),
    'Bundle sem inventário válido'
  )
  requireCondition(
    report.assets.reduce((sum, asset) => sum + asset.gzipBytes, 0) ===
      report.metrics.rendererGzipBytes,
    'Tamanho do bundle inconsistente'
  )
  return report.metrics
}
