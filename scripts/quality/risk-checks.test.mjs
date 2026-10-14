import assert from 'node:assert/strict'
import test from 'node:test'
import {
  measureChangedCoverage,
  parseChangedLines,
  validateChangedCoverage,
  validatePerformance,
  validateSast
} from './risk-checks.mjs'

const metadata = {
  sha: 'commit',
  platform: 'darwin',
  worktreeDirty: false,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null
}
const coverage = {
  '/workspace/src/a.ts': {
    statementMap: { 0: { start: { line: 3 } }, 1: { start: { line: 5 } } },
    s: { 0: 1, 1: 0 }
  }
}
const expected = { base: 'base', changes: [{ file: 'src/a.ts', lines: [3, 4, 5] }] }

await test('diff usa linhas novas, ignora remoções e não mistura testes com produção', () => {
  assert.deepEqual(
    parseChangedLines(
      '+++ b/src/a.ts\n@@ -3,2 +3,2 @@\n-old\n+new\n+next\n+++ b/src/a.test.ts\n@@ -0,0 +1 @@\n+test'
    ),
    [{ file: 'src/a.ts', lines: [3, 4] }]
  )
  assert.deepEqual(parseChangedLines('+++ /dev/null\n@@ -1 +0,0 @@\n-old'), [])
})

await test('cobertura diferencial não conta comentários e recusa fonte omitida ou contagem falsa', () => {
  const measurement = measureChangedCoverage(coverage, expected.changes, '/workspace', 80)
  assert.equal(measurement.total, 2)
  assert.equal(measurement.pct, 50)
  const report = { ...metadata, base: 'base', measurement }
  assert.throws(
    () => validateChangedCoverage(report, coverage, expected, '/workspace', 80, 'commit', 'darwin'),
    /Linhas alteradas/
  )
  assert.throws(() => measureChangedCoverage({}, expected.changes, '/workspace', 80), /omitiu/)
  assert.throws(
    () => measureChangedCoverage(coverage, [{ file: 'src/a.ts', lines: [3, 3] }], '/workspace', 80),
    /duplicada/
  )
  assert.throws(
    () =>
      validateChangedCoverage(
        { ...report, measurement: { ...measurement, pct: 100, success: true } },
        coverage,
        expected,
        '/workspace',
        80,
        'commit',
        'darwin'
      ),
    /inconsistente/
  )
  assert.throws(
    () =>
      validateChangedCoverage(
        { ...report, sha: 'outro' },
        coverage,
        expected,
        '/workspace',
        80,
        'commit',
        'darwin'
      ),
    /outro SHA/
  )
})

await test('diff sem código executável é válido e uma alteração coberta precisa da base correta', () => {
  const measured = measureChangedCoverage(
    coverage,
    [{ file: 'src/a.ts', lines: [3] }],
    '/workspace',
    80
  )
  const expected = { base: 'base', changes: [{ file: 'src/a.ts', lines: [3] }] }
  const report = { ...metadata, base: 'base', measurement: measured }
  assert.equal(
    validateChangedCoverage(report, coverage, expected, '/workspace', 80, 'commit', 'darwin').pct,
    100
  )
  assert.throws(
    () =>
      validateChangedCoverage(
        { ...report, base: 'outra' },
        coverage,
        expected,
        '/workspace',
        80,
        'commit',
        'darwin'
      ),
    /outra base/
  )
  assert.equal(measureChangedCoverage(coverage, [], '/workspace', 80).pct, 100)
})

await test('SAST exige regras comprovadas, todas as fontes, versão e scan sem erros', () => {
  const report = {
    ...metadata,
    success: true,
    version: '1.180.0',
    policyHash: 'hash',
    rules: ['rule']
  }
  const raw = { version: '1.180.0', results: [], errors: [], paths: { scanned: ['src/a.ts'] } }
  const fixtures = { errors: [], results: [{ check_id: 'rule', path: '/temp/rule-unsafe.tsx' }] }
  const run = (r = report, scan = raw, cases = fixtures) =>
    validateSast(r, scan, cases, [{ id: 'rule' }], 'hash', ['src/a.ts'], 'commit')
  assert.deepEqual(run(), { rules: 1, files: 1 })
  assert.throws(() => run({ ...report, version: 'antiga' }), /versão/)
  assert.throws(() => run({ ...report, rules: [] }), /divergente/)
  assert.throws(() => run({ ...report, policyHash: 'outro' }), /divergente/)
  assert.throws(() => run(report, { ...raw, results: [{}] }), /achados/)
  assert.throws(() => run(report, { ...raw, errors: [{ type: 'timeout' }] }), /erros/)
  assert.throws(() => run(report, { ...raw, paths: { scanned: [] } }), /omitiu/)
  assert.throws(() => run(report, raw, { errors: [], results: [] }), /provas/)
  assert.throws(
    () =>
      run(report, raw, {
        errors: [],
        results: [{ check_id: 'rule', path: '/temp/rule-safe.tsx' }]
      }),
    /não comprovada/
  )
})

await test('performance recusa benchmark vazio, excesso de tamanho/latência e valores falsos', () => {
  const policy = {
    patients: 10000,
    samples: 100,
    maximums: { rendererGzipBytes: 20, searchP95Ms: 10 }
  }
  const report = {
    ...metadata,
    success: true,
    benchmark: { patients: 10000, samples: 100, resultsVerified: true },
    metrics: { rendererGzipBytes: 10, searchP95Ms: 2 },
    assets: [{ file: 'index.js', gzipBytes: 10, sha256: 'a'.repeat(64) }]
  }
  const run = (r) => validatePerformance(r, policy, 'commit', 'darwin')
  assert.deepEqual(run(report), report.metrics)
  assert.throws(() => run({ ...report, benchmark: { patients: 0 } }), /vazio/)
  assert.throws(
    () => run({ ...report, metrics: { ...report.metrics, rendererGzipBytes: 21 } }),
    /Regressão/
  )
  assert.throws(
    () => run({ ...report, metrics: { ...report.metrics, searchP95Ms: NaN } }),
    /Regressão/
  )
  assert.throws(() => run({ ...report, assets: [] }), /inventário/)
  assert.throws(
    () => run({ ...report, assets: [{ ...report.assets[0], gzipBytes: 8 }] }),
    /inconsistente/
  )
})
