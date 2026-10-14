import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCoverage, validateExtendedReport, validateMutations } from './extended-checks.mjs'

const metadata = {
  sha: 'commit',
  platform: 'darwin',
  worktreeDirty: false,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  startedAt: 100,
  finishedAt: 200
}

await test('cobertura inclui arquivos sem teste e impede redução dos módulos críticos', () => {
  const metrics = { lines: { pct: 90 }, branches: { pct: 80 } }
  const policy = {
    productionFiles: ['src/a.ts'],
    minimums: { lines: 50 },
    critical: { 'src/a.ts': { branches: 80 } }
  }
  const summary = { total: metrics, '/workspace/src/a.ts': metrics }
  assert.deepEqual(validateCoverage(summary, policy, '/workspace'), { lines: 90, branches: 80 })
  assert.throws(() => validateCoverage({ total: metrics }, policy, '/workspace'), /omitiu arquivo/)
  assert.throws(
    () =>
      validateCoverage(
        { ...summary, '/workspace/src/a.ts': { branches: { pct: 79 } } },
        policy,
        '/workspace'
      ),
    /insuficiente/
  )
  assert.throws(
    () => validateCoverage({ ...summary, total: { lines: { pct: NaN } } }, policy, '/workspace'),
    /insuficiente/
  )
})

await test('relatório de geração visual nunca é aceito como aprovação', () => {
  const report = {
    ...metadata,
    success: true,
    mode: 'verify',
    checks: [{ name: 'interface', status: 'passed' }]
  }
  assert.equal(validateExtendedReport(report, ['interface'], 'commit', 'darwin'), 1)
  assert.throws(
    () =>
      validateExtendedReport({ ...report, mode: 'reference' }, ['interface'], 'commit', 'darwin'),
    /não aprova/
  )
  assert.throws(
    () => validateExtendedReport(report, ['interface', 'reiniciar'], 'commit', 'darwin'),
    /ausente/
  )
  assert.throws(() => validateExtendedReport(report, ['interface'], 'outro', 'darwin'), /outro SHA/)
})

await test('mutação precisa conter todos os erros previstos, detectados por assertions reais', () => {
  const catalog = { mutants: [{ id: 'conflito', file: 'src/a.ts' }] }
  const report = {
    ...metadata,
    success: true,
    mutants: [{ id: 'conflito', file: 'src/a.ts', status: 'killed', failedTests: 1 }]
  }
  assert.equal(validateMutations(report, catalog, 'commit', 'darwin'), 1)
  for (const mutant of [
    { ...report.mutants[0], status: 'survived' },
    { ...report.mutants[0], failedTests: 0 },
    { ...report.mutants[0], file: 'outra.ts' }
  ])
    assert.throws(
      () => validateMutations({ ...report, mutants: [mutant] }, catalog, 'commit', 'darwin'),
      /não detectada/
    )
  assert.throws(
    () => validateMutations({ ...report, mutants: [] }, catalog, 'commit', 'darwin'),
    /incompleto/
  )
  assert.throws(
    () =>
      validateMutations(
        { ...report, mutants: [report.mutants[0], report.mutants[0]] },
        catalog,
        'commit',
        'darwin'
      ),
    /duplicado/
  )
})
