import { readFileSync } from 'node:fs'
import { collectChangedLines, measureChangedCoverage } from './risk-checks.mjs'
import { requireCondition } from './checks.mjs'
import { execution, writeJson } from './evidence.mjs'

const startedAt = Date.now()
const expected = collectChangedLines(process.env.BASE_SHA)
const policy = JSON.parse(readFileSync('docs/qualidade/cobertura.json', 'utf8'))
const run = JSON.parse(readFileSync('.quality/test-run.json', 'utf8'))
const measurement = measureChangedCoverage(
  JSON.parse(readFileSync('.quality/coverage/coverage-final.json', 'utf8')),
  expected.changes,
  run.root,
  policy.changedLinesMinimum
)
writeJson('.quality/changed-coverage.json', {
  ...execution(startedAt),
  base: expected.base,
  measurement
})
requireCondition(
  measurement.success,
  `Cobertura das linhas alteradas: ${measurement.pct.toFixed(2)}% < ${measurement.minimum}%`
)
console.log(
  `Linhas executáveis alteradas: ${measurement.covered}/${measurement.total} (${measurement.pct.toFixed(2)}%).`
)
