import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import electron from 'electron'
import { execution, writeJson } from './evidence.mjs'
import { requireCondition } from './checks.mjs'
import { sha256, validatePerformance } from './risk-checks.mjs'

const startedAt = Date.now()
const report = { ...execution(startedAt), success: false }
const directory = '.quality/performance'
try {
  writeJson(join(directory, 'results.json'), report)
  const assets = resolve('out/renderer/assets')
  report.assets = readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => {
      const bytes = readFileSync(join(assets, file))
      return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }
    })
  const result = spawnSync(
    electron,
    ['scripts/quality/benchmark.mjs', resolve(directory, 'benchmark.json')],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
      timeout: 60_000
    }
  )
  requireCondition(
    !result.error && result.status === 0,
    `Benchmark falhou: ${result.stderr || result.error?.message}`
  )
  const benchmark = JSON.parse(readFileSync(join(directory, 'benchmark.json'), 'utf8'))
  report.benchmark = benchmark
  report.metrics = {
    rendererGzipBytes: report.assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    searchP95Ms: benchmark.p95Ms
  }
  report.success = true
  validatePerformance(
    report,
    JSON.parse(readFileSync('docs/qualidade/desempenho.json', 'utf8')),
    report.sha,
    process.platform
  )
  console.log(
    `Desempenho: JS gzip ${report.metrics.rendererGzipBytes} bytes; busca de ${benchmark.patients} pacientes p95 ${benchmark.p95Ms.toFixed(2)} ms.`
  )
} catch (error) {
  report.success = false
  report.error = error.message
  console.error(error.message)
  process.exitCode = 1
} finally {
  writeJson(join(directory, 'results.json'), { ...report, ...execution(startedAt) })
}
