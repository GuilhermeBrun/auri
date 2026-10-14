import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  validateTests,
  validateScenarios,
  validateE2e,
  validateAudit,
  validateJobs,
  validateCiExecution,
  validatePolicyChanges
} from './checks.mjs'

function fixture() {
  return {
    run: {
      sha: 'abc',
      platform: 'darwin',
      root: '/repo',
      startedAt: 10,
      finishedAt: 30,
      exitCode: 0
    },
    inventory: {
      tests: [{ file: 'src/a.test.ts', name: 'protege dados', requiredOn: ['darwin', 'win32'] }]
    },
    report: {
      success: true,
      startTime: 20,
      numTotalTests: 1,
      numPassedTests: 1,
      numFailedTests: 0,
      numTodoTests: 0,
      testResults: [
        {
          name: '/repo/src/a.test.ts',
          status: 'passed',
          assertionResults: [{ fullName: 'protege dados', status: 'passed' }]
        }
      ]
    }
  }
}
const check = (f) => validateTests(f.report, f.run, f.inventory, 'abc', 'darwin')

await test('relatório Windows normaliza caminhos sem perder a identidade do teste', () => {
  const f = fixture()
  f.run.platform = 'win32'
  f.run.root = 'D:\\a\\auri'
  f.report.testResults[0].name = 'D:/a/auri/src/a.test.ts'
  assert.equal(validateTests(f.report, f.run, f.inventory, 'abc', 'win32').size, 1)
})

await test('aceita evidência completa e recusa remoção de teste do inventário', () => {
  const f = fixture()
  assert.equal(check(f).size, 1)
  f.report.testResults[0].assertionResults[0].fullName = 'outro teste'
  assert.throws(() => check(f), /não coletado/)
})

await test('zero testes não recebe aprovação', () => {
  const f = fixture()
  f.report.testResults = []
  f.report.numTotalTests = 0
  assert.throws(() => check(f), /Zero testes/)
})

await test('skip obrigatório e todo não são aprovação', () => {
  for (const status of ['skipped', 'todo']) {
    const f = fixture()
    f.report.testResults[0].assertionResults[0].status = status
    assert.throws(() => check(f), /não aprovado/)
  }
})

await test('skip de plataforma só vale fora da plataforma obrigatória', () => {
  const f = fixture()
  f.inventory.tests[0].requiredOn = ['win32']
  f.inventory.tests[0].reason = 'Integração Windows'
  f.report.testResults[0].assertionResults[0].status = 'skipped'
  f.report.numPassedTests = 0
  assert.equal(check(f).size, 1)
  f.run.platform = 'win32'
  assert.throws(() => validateTests(f.report, f.run, f.inventory, 'abc', 'win32'), /não aprovado/)
})

await test('um teste novo pulado não entra pela exceção de outro', () => {
  const f = fixture()
  f.report.testResults[0].assertionResults.push({ fullName: 'novo skip', status: 'skipped' })
  f.report.numTotalTests = 2
  assert.throws(() => check(f), /não aprovado/)
})

await test('relatório antigo, outro SHA, falha e contagem falsa são rejeitados', () => {
  for (const mutate of [
    (f) => {
      f.report.startTime = 1
    },
    (f) => {
      f.run.sha = 'outro'
    },
    (f) => {
      f.run.exitCode = 1
    },
    (f) => {
      f.report.numTotalTests = 2
    }
  ]) {
    const f = fixture()
    mutate(f)
    assert.throws(() => check(f))
  }
})

await test('IDs e nomes duplicados não escondem ausência de cenário', () => {
  const f = fixture()
  f.report.testResults[0].assertionResults.push(f.report.testResults[0].assertionResults[0])
  assert.throws(() => check(f), /duplicado/)
  const scenario = { id: 'AURI-01', evidence: [{ kind: 'e2e', name: 'inicia' }] }
  assert.throws(
    () =>
      validateScenarios(
        { scenarios: [scenario, scenario] },
        new Map(),
        new Map([['inicia', 'passed']])
      ),
    /duplicado/
  )
})

await test('cenário só passa se cada evidência requerida passar', () => {
  const catalog = { scenarios: [{ id: 'AURI-01', evidence: [{ kind: 'e2e', name: 'inicia' }] }] }
  assert.throws(() => validateScenarios(catalog, new Map(), new Map()), /sem evidência/)
  assert.deepEqual(validateScenarios(catalog, new Map(), new Map([['inicia', 'passed']])), [
    'AURI-01'
  ])
})

await test('E2E vazio ou com uma falha é rejeitado', () => {
  const report = {
    sha: 'abc',
    platform: 'darwin',
    success: true,
    startedAt: 1,
    finishedAt: 2,
    checks: []
  }
  assert.throws(() => validateE2e(report, 'abc', 'darwin'), /vazio/)
  report.checks = [{ name: 'inicia', status: 'failed' }]
  assert.throws(() => validateE2e(report, 'abc', 'darwin'), /reprovado/)
})

await test('skip/neutral/cancelamento/ausência de job obrigatório bloqueiam o resultado final', () => {
  for (const result of ['skipped', 'neutral', 'cancelled', 'failure', undefined]) {
    const jobs = {
      policy: { result: 'success' },
      checks: { result: 'success' },
      security: { result }
    }
    assert.throws(() => validateJobs(jobs), /não aprovado/)
  }
  validateJobs({
    policy: { result: 'success' },
    checks: { result: 'success' },
    security: { result: 'success' }
  })
})

await test('CI rejeita artefato de outra tentativa ou código modificado após checkout', () => {
  const evidence = { runId: '123', runAttempt: '2', worktreeDirty: false }
  validateCiExecution(evidence, '123', '2')
  assert.throws(() => validateCiExecution(evidence, '123', '3'), /outra execução/)
  evidence.worktreeDirty = true
  assert.throws(() => validateCiExecution(evidence, '123', '2'), /modificado após/)
})

await test('erro do audit e vulnerabilidade alta bloqueiam; moderadas são registradas', () => {
  assert.throws(() => validateAudit({ error: { code: 'OFFLINE' } }), /inválido/)
  const audit = {
    metadata: { vulnerabilities: { high: 0, critical: 0, moderate: 1 } },
    vulnerabilities: { exemplo: { name: 'exemplo', severity: 'moderate' } }
  }
  assert.equal(validateAudit(audit).moderate, 1)
  audit.vulnerabilities.exemplo.severity = 'high'
  assert.throws(() => validateAudit(audit), /altas/)
})

await test('alterar assertion, configuração ou catálogo precisa de revisão explícita', () => {
  for (const file of [
    'src/main/a.test.ts',
    'vitest.config.ts',
    'vite.config.ts',
    '.github/workflows/quality.yml',
    'docs/qualidade/testes.json'
  ]) {
    assert.throws(() => validatePolicyChanges([file], false), /revisão/)
    assert.deepEqual(validatePolicyChanges([file], true), [file])
  }
  assert.deepEqual(validatePolicyChanges(['src/main/a.ts'], false), [])
})

await test('verificador da base bloqueia mudança sensível mesmo com checker candidato enfraquecido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auri-policy-contract-'))
  const source = fileURLToPath(new URL('../../', import.meta.url))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'docs'), { recursive: true })
    cpSync(join(source, 'scripts/quality'), join(dir, 'scripts/quality'), { recursive: true })
    cpSync(join(source, 'docs/qualidade'), join(dir, 'docs/qualidade'), { recursive: true })
    writeFileSync(join(dir, '.gitignore'), '.quality/\n')
    git('init', '--quiet')
    git('add', '.')
    git(
      '-c',
      'user.name=Teste Auri',
      '-c',
      'user.email=teste@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture'
    )
    const base = git('rev-parse', 'HEAD')
    const trusted = join(dir, '.quality/trusted')
    mkdirSync(join(trusted, 'scripts'), { recursive: true })
    mkdirSync(join(trusted, 'docs'), { recursive: true })
    cpSync(join(dir, 'scripts/quality'), join(trusted, 'scripts/quality'), { recursive: true })
    cpSync(join(dir, 'docs/qualidade'), join(trusted, 'docs/qualidade'), { recursive: true })
    const env = {
      ...process.env,
      BASE_SHA: base,
      EXPECTED_SHA: base,
      GITHUB_EVENT_NAME: 'pull_request',
      PR_NUMBER: ''
    }
    const check = () =>
      spawnSync(process.execPath, [join(trusted, 'scripts/quality/cli.mjs'), 'policy'], {
        cwd: dir,
        env,
        encoding: 'utf8'
      })
    assert.equal(check().status, 0)
    // Uma alteração no candidato não altera o módulo que valida a base.
    writeFileSync(
      join(dir, 'scripts/quality/checks.mjs'),
      'export const validatePolicyChanges = () => []\n'
    )
    const rejected = check()
    assert.equal(rejected.status, 1)
    assert.match(rejected.stderr, /Mudanças na proteção exigem revisão/)
    const missingBase = spawnSync(
      process.execPath,
      [join(trusted, 'scripts/quality/cli.mjs'), 'policy'],
      {
        cwd: dir,
        env: { ...env, BASE_SHA: 'f'.repeat(40) },
        encoding: 'utf8'
      }
    )
    assert.equal(missingBase.status, 1)
    assert.match(missingBase.stderr, /Base aprovada indisponível/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
