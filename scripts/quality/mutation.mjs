import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'
import { execution, writeJson } from './evidence.mjs'
import { requireCondition } from './checks.mjs'

const startedAt = Date.now()
const sandbox = mkdtempSync(join(tmpdir(), 'auri-mutation-'))
const output = resolve('.quality/mutation')
const catalog = JSON.parse(readFileSync('docs/qualidade/mutacoes.json', 'utf8'))
const mutants = []
mkdirSync(output, { recursive: true })

function run(id, tests) {
  const report = join(output, `${id}.json`)
  const result = spawnSync(
    electron,
    [
      fileURLToPath(import.meta.resolve('vite-plus/bin')),
      'test',
      ...tests,
      '--coverage=false',
      '--reporter=json',
      `--outputFile=${report}`
    ],
    {
      cwd: sandbox,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', AURI_QUALITY: '0' },
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024
    }
  )
  writeFileSync(join(output, `${id}.log`), (result.stdout || '') + (result.stderr || ''))
  requireCondition(!result.error, `${id}: execução indisponível: ${result.error?.message}`)
  const evidence = JSON.parse(readFileSync(report, 'utf8'))
  requireCondition(
    evidence.numTotalTests > 0 && evidence.testResults.length > 0,
    `${id}: nenhum teste coletado`
  )
  const assertions = evidence.testResults.flatMap((file) => file.assertionResults)
  requireCondition(
    assertions.length === evidence.numTotalTests,
    `${id}: erro de importação ou relatório incompleto`
  )
  return {
    evidence,
    exitCode: result.status,
    identities: assertions.map((test) => test.fullName).sort()
  }
}

try {
  requireCondition(
    catalog.mutants.length > 0 &&
      new Set(catalog.mutants.map((m) => m.id)).size === catalog.mutants.length,
    'Catálogo de mutação vazio/duplicado'
  )
  for (const path of [
    'src',
    'docs/qualidade',
    'vite.config.ts',
    'tsconfig.json',
    'tsconfig.node.json',
    'tsconfig.web.json',
    'package.json'
  ]) {
    cpSync(path, join(sandbox, path), { recursive: true })
  }
  symlinkSync(
    resolve('node_modules'),
    join(sandbox, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  const tests = [...new Set(catalog.mutants.flatMap((mutant) => mutant.tests))]
  const baseline = run('baseline', tests)
  requireCondition(
    baseline.exitCode === 0 && baseline.evidence.success && baseline.evidence.numFailedTests === 0,
    'A suíte original precisa passar antes da mutação'
  )
  for (const mutant of catalog.mutants) {
    const file = join(sandbox, mutant.file)
    const original = readFileSync(file, 'utf8')
    requireCondition(
      original.split(mutant.from).length === 2,
      `${mutant.id}: alvo mudou; revise a mutação explicitamente`
    )
    const expected = baseline.evidence.testResults
      .filter((file) =>
        mutant.tests.some((test) => file.name.replaceAll('\\', '/').endsWith('/' + test))
      )
      .flatMap((file) => file.assertionResults.map((test) => test.fullName))
      .sort()
    try {
      writeFileSync(file, original.replace(mutant.from, mutant.to))
      const result = run(mutant.id, mutant.tests)
      requireCondition(
        JSON.stringify(result.identities) === JSON.stringify(expected),
        `${mutant.id}: inventário de testes mudou durante a mutação`
      )
      const killed =
        result.exitCode !== 0 &&
        result.evidence.numFailedTests > 0 &&
        result.evidence.testResults.some((file) =>
          file.assertionResults.some((test) => test.status === 'failed')
        )
      mutants.push({
        id: mutant.id,
        file: mutant.file,
        status: killed ? 'killed' : 'survived',
        failedTests: result.evidence.numFailedTests
      })
      console.log(`${killed ? '✓' : '✗'} ${mutant.id}`)
    } finally {
      writeFileSync(file, original)
    }
  }
  requireCondition(
    mutants.every((mutant) => mutant.status === 'killed'),
    'Mutação sobrevivente: a suíte deixou de detectar um erro obrigatório'
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  writeJson(join(output, 'results.json'), {
    ...execution(startedAt),
    success: !process.exitCode,
    mutants
  })
  rmSync(sandbox, { recursive: true, force: true })
}
