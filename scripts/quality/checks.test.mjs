import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  validatePolicyChanges,
  parseNameStatus,
  policyFiles,
  needsReview,
  isAdditive,
  packagingChanged
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

await test('configuração e verificador exigem revisão; testes e código comum não', () => {
  for (const file of [
    'vitest.config.ts',
    'vite.config.ts',
    '.github/workflows/quality.yml',
    'scripts/quality/util.mjs',
    'scripts/quality/novo.test.mjs',
    'src/main/ipc-security.ts',
    'electron-builder.yml'
  ]) {
    assert.equal(needsReview({ status: 'M', file }), true, file)
    assert.equal(needsReview({ status: 'A', file }), true, file)
  }
  for (const entry of [
    { status: 'M', file: 'src/main/a.ts' },
    { status: 'A', file: 'src/renderer/novo.test.tsx' },
    { status: 'M', file: 'src/main/a.test.ts' },
    { status: 'D', file: 'src/main/antigo.test.ts' },
    { status: 'M', file: 'package-lock.json' },
    { status: 'M', file: 'docs/qualidade/visual/darwin/aparencia-claro.png' },
    { status: 'M', file: 'docs/qualidade/politica.md' },
    { status: 'A', file: 'docs/qualidade/fixtures/v2.sql' }
  ])
    assert.equal(needsReview(entry), false, entry.file)
  for (const entry of [
    { status: 'M', file: 'docs/qualidade/fixtures/v1.sql' },
    { status: 'D', file: 'docs/qualidade/fixtures/v1.sql' },
    { status: 'M', file: 'docs/qualidade/gitleaks.toml' },
    { status: 'D', file: 'docs/qualidade/testes.json' }
  ])
    assert.equal(needsReview(entry), true, entry.file)
  assert.deepEqual(validatePolicyChanges([], false), [])
  assert.throws(() => validatePolicyChanges(['vite.config.ts'], false), /revisão/)
  assert.deepEqual(validatePolicyChanges(['vite.config.ts'], true), ['vite.config.ts'])
})

await test('política em JSON só dispensa revisão quando apenas acrescenta', () => {
  const file = 'docs/qualidade/testes.json'
  const review = (before, after) =>
    needsReview({ status: 'M', file }, JSON.stringify(before), JSON.stringify(after))
  const test = { file: 'a.test.ts', name: 'a', requiredOn: ['darwin', 'win32'] }
  const base = { version: 1, tests: [test] }
  assert.equal(review(base, { version: 1, tests: [test, { ...test, name: 'b' }] }), false)
  assert.equal(review(base, { version: 1, tests: [] }), true)
  assert.equal(review(base, { version: 1, tests: [{ ...test, requiredOn: ['darwin'] }] }), true)
  assert.equal(review(base, { version: 1, tests: [{ ...test, reason: 'pular' }] }), true)
  assert.equal(review(base, { version: 2, tests: [test] }), true)
  const coverage = { minimums: { lines: 35 }, critical: { 'a.ts': { lines: 100 } } }
  assert.equal(
    review(coverage, { ...coverage, critical: { ...coverage.critical, 'b.ts': { lines: 90 } } }),
    false
  )
  assert.equal(review(coverage, { ...coverage, minimums: { lines: 30 } }), true)
  assert.equal(review(coverage, { minimums: coverage.minimums }), true)
  assert.equal(needsReview({ status: 'M', file }, '{', '{}'), true)
  assert.equal(isAdditive([1, 2], [2, 1, 3]), true)
  assert.equal(isAdditive({ a: [1] }, { a: 1 }), false)
})

await test('package.json dispensa revisão só em versão e dependências', () => {
  const manifest = {
    name: 'auri',
    version: '1.0.0',
    scripts: { test: 'node scripts/run-tests.mjs' },
    dependencies: { zod: '^4.6.5' },
    devDependencies: { vite: '^7.2.6' }
  }
  const review = (after, status = 'M') =>
    needsReview({ status, file: 'package.json' }, JSON.stringify(manifest), JSON.stringify(after))
  assert.equal(
    review({
      ...manifest,
      version: '1.1.0',
      dependencies: { zod: '^4.7.0', novo: '1.0.0' },
      devDependencies: {}
    }),
    false
  )
  assert.equal(review({ ...manifest, scripts: { test: 'true' } }), true)
  assert.equal(review({ ...manifest, engines: { node: '>=20' } }), true)
  assert.equal(review(manifest, 'D'), true)
})

await test('PR só da interface não reempacota; main e mudanças do pacote reempacotam', () => {
  const ui = ['src/renderer/src/pages/AgendaPage.tsx', 'docs/qualidade/visual/win32/a.png']
  assert.equal(packagingChanged(ui, true), false)
  assert.equal(packagingChanged(ui, false), true)
  assert.equal(packagingChanged([], false), true)
  for (const file of [
    'package-lock.json',
    'electron-builder.yml',
    'src/main/index.ts',
    'src/preload/index.ts',
    'src/shared/api.ts',
    'resources/icon.png',
    'scripts/e2e.mjs',
    '.github/workflows/build.yml'
  ])
    assert.equal(packagingChanged([...ui, file], true), true, file)
})

await test('lista de arquivos usa o conteúdo da base e do candidato', () => {
  const entries = parseNameStatus(
    [
      'A\tsrc/renderer/novo.test.tsx',
      'M\tsrc/main/a.test.ts',
      'M\tdocs/qualidade/testes.json',
      'M\tscripts/quality/cli.mjs'
    ].join('\n')
  )
  assert.deepEqual(entries[0], { status: 'A', file: 'src/renderer/novo.test.tsx' })
  const read = ({ file }) =>
    file === 'docs/qualidade/testes.json' ? { before: '{"tests":[1]}', after: '{"tests":[]}' } : {}
  assert.deepEqual(policyFiles(entries, read), [
    'docs/qualidade/testes.json',
    'scripts/quality/cli.mjs'
  ])
})

await test('política aceita testes e inventário acrescido; recusa inventário reduzido e scripts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auri-policy-tests-'))
  const source = fileURLToPath(new URL('../../', import.meta.url))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  const commit = (message) =>
    git(
      '-c',
      'user.name=Teste Auri',
      '-c',
      'user.email=teste@example.invalid',
      'commit',
      '--quiet',
      '-m',
      message
    )
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'docs'), { recursive: true })
    mkdirSync(join(dir, 'src/main'), { recursive: true })
    cpSync(join(source, 'scripts/quality'), join(dir, 'scripts/quality'), { recursive: true })
    cpSync(join(source, 'docs/qualidade'), join(dir, 'docs/qualidade'), { recursive: true })
    writeFileSync(join(dir, '.gitignore'), '.quality/\n')
    writeFileSync(join(dir, 'src/main/a.test.ts'), "test('a', () => {})\n")
    git('init', '--quiet')
    git('add', '.')
    commit('fixture')
    const base = git('rev-parse', 'HEAD')
    const env = {
      ...process.env,
      BASE_SHA: base,
      EXPECTED_SHA: base,
      GITHUB_EVENT_NAME: 'pull_request',
      PR_NUMBER: ''
    }
    const check = () =>
      spawnSync(process.execPath, [join(dir, 'scripts/quality/cli.mjs'), 'policy'], {
        cwd: dir,
        env,
        encoding: 'utf8'
      })
    // Teste novo, não rastreado ou já commitado, passa sem revisão.
    writeFileSync(join(dir, 'src/main/novo.test.ts'), "test('novo', () => {})\n")
    const added = check()
    assert.equal(added.status, 0, added.stderr)
    git('add', '.')
    commit('teste novo')
    assert.equal(check().status, 0)
    // Alterar ou renomear teste também: o inventário da base reprova o que sumir dele.
    git('mv', 'src/main/a.test.ts', 'src/main/b.test.ts')
    commit('renomeia')
    assert.equal(check().status, 0)
    git('reset', '--quiet', '--hard', base)
    writeFileSync(join(dir, 'src/main/a.test.ts'), "test.skip('a', () => {})\n")
    assert.equal(check().status, 0)
    git('reset', '--quiet', '--hard', base)
    const inventoryFile = join(dir, 'docs/qualidade/testes.json')
    const inventory = JSON.parse(readFileSync(inventoryFile, 'utf8'))
    const extra = { file: 'src/main/novo.test.ts', name: 'novo', requiredOn: ['darwin'] }
    writeFileSync(
      inventoryFile,
      JSON.stringify({ ...inventory, tests: [...inventory.tests, extra] })
    )
    assert.equal(check().status, 0)
    writeFileSync(inventoryFile, JSON.stringify({ ...inventory, tests: inventory.tests.slice(1) }))
    assert.match(check().stderr, /revisão do SHA: docs\/qualidade\/testes\.json$/m)
    git('reset', '--quiet', '--hard', base)
    writeFileSync(join(dir, 'scripts/quality/novo.mjs'), '\n')
    assert.match(check().stderr, /revisão do SHA: scripts\/quality\/novo\.mjs$/m)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
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
