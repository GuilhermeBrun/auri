export function requireCondition(ok, message) {
  if (!ok) throw new Error(message)
}

export const testKey = (file, name) => `${file}::${name}`
const keyOf = (test) => testKey(test.file, test.name)

export function validateTests(report, run, inventory, sha, platform) {
  requireCondition(run.sha === sha && run.platform === platform, 'Testes de outro SHA/plataforma.')
  requireCondition(run.exitCode === 0 && report.success === true, 'Execução dos testes falhou.')
  requireCondition(
    Number.isFinite(run.startedAt) &&
      run.finishedAt >= run.startedAt &&
      report.startTime >= run.startedAt &&
      report.startTime <= run.finishedAt,
    'Relatório antigo ou sem horário de execução válido.'
  )
  const expected = new Map(inventory.tests.map((test) => [keyOf(test), test]))
  requireCondition(
    expected.size === inventory.tests.length && expected.size > 0,
    'Inventário vazio ou duplicado.'
  )
  const collected = new Map()
  const root = run.root.replaceAll('\\', '/').replace(/\/$/, '') + '/'
  for (const file of report.testResults) {
    requireCondition(file.status === 'passed', `Arquivo não aprovado: ${file.name}`)
    const filename = file.name.replaceAll('\\', '/')
    requireCondition(filename.startsWith(root), 'Teste fora do workspace declarado.')
    const relative = filename.slice(root.length)
    for (const test of file.assertionResults) {
      const key = testKey(relative, test.fullName)
      requireCondition(!collected.has(key), `Teste duplicado: ${key}`)
      const baseline = expected.get(key)
      const intentionalSkip =
        test.status === 'skipped' && baseline?.reason && !baseline.requiredOn.includes(platform)
      requireCondition(
        test.status === 'passed' || intentionalSkip,
        `Teste não aprovado: ${key} (${test.status})`
      )
      collected.set(key, test.status)
    }
  }
  requireCondition(
    collected.size > 0 && collected.size === report.numTotalTests,
    'Zero testes ou contagem inconsistente.'
  )
  const passed = [...collected.values()].filter((status) => status === 'passed').length
  requireCondition(
    passed === report.numPassedTests && report.numFailedTests === 0 && report.numTodoTests === 0,
    'Resumo dos testes inconsistente ou contém falhas/todos.'
  )
  for (const [key, test] of expected) {
    requireCondition(collected.has(key), `Teste do inventário não coletado: ${key}`)
    if (test.requiredOn.includes(platform))
      requireCondition(collected.get(key) === 'passed', `Teste obrigatório pulado: ${key}`)
  }
  return collected
}

export function validateE2e(report, sha, platform) {
  requireCondition(
    report.sha === sha && report.platform === platform,
    'E2E de outro SHA/plataforma.'
  )
  requireCondition(
    report.success === true && report.checks.length > 0,
    'E2E ausente, vazio ou reprovado.'
  )
  requireCondition(
    Number.isFinite(report.startedAt) && report.finishedAt >= report.startedAt,
    'E2E sem horário válido.'
  )
  const collected = new Map()
  for (const check of report.checks) {
    requireCondition(
      check.status === 'passed' && !collected.has(check.name),
      `E2E reprovado/duplicado: ${check.name}`
    )
    collected.set(check.name, check.status)
  }
  return collected
}

export function validateScenarios(catalog, tests, e2e) {
  const ids = new Set()
  for (const scenario of catalog.scenarios) {
    requireCondition(
      !ids.has(scenario.id) && scenario.evidence.length > 0,
      `Cenário vazio/duplicado: ${scenario.id}`
    )
    ids.add(scenario.id)
    for (const evidence of scenario.evidence) {
      requireCondition(
        ['vitest', 'e2e'].includes(evidence.kind),
        `Evidência desconhecida: ${scenario.id}`
      )
      const status =
        evidence.kind === 'vitest' ? tests.get(keyOf(evidence)) : e2e.get(evidence.name)
      requireCondition(
        status === 'passed',
        `Cenário obrigatório sem evidência: ${scenario.id} (${evidence.name})`
      )
    }
  }
  requireCondition(ids.size > 0, 'Catálogo de cenários vazio.')
  return [...ids]
}

export function validateAudit(audit) {
  requireCondition(
    !audit.error && audit.metadata?.vulnerabilities && audit.vulnerabilities,
    'npm audit indisponível ou relatório inválido.'
  )
  const blocked = Object.values(audit.vulnerabilities).filter((finding) =>
    ['high', 'critical'].includes(finding.severity)
  )
  requireCondition(
    blocked.length === 0 &&
      audit.metadata.vulnerabilities.high === 0 &&
      audit.metadata.vulnerabilities.critical === 0,
    `Vulnerabilidades altas/críticas: ${blocked.map((finding) => finding.name).join(', ')}`
  )
  return audit.metadata.vulnerabilities
}

export function validateJobs(jobs) {
  for (const name of ['policy', 'checks', 'security']) {
    requireCondition(
      jobs[name]?.result === 'success',
      `Job obrigatório não aprovado: ${name} (${jobs[name]?.result ?? 'ausente'})`
    )
  }
}

export function validateCiExecution(evidence, runId, attempt) {
  requireCondition(
    evidence.runId === runId && evidence.runAttempt === attempt,
    'Evidência de outra execução/tentativa.'
  )
  requireCondition(evidence.worktreeDirty === false, 'Código do CI modificado após o checkout.')
}

// Código que decide o que é testado e como: qualquer mudança exige revisão do SHA.
const protectedConfig =
  /^(\.github\/|\.gitattributes$|\.editorconfig$|scripts\/|src\/main\/ipc(-security)?\.ts$|(electron\.)?vite(st)?\.config\.|eslint\.config\.|\.prettier|tsconfig|electron-builder\.yml$)/
const policyJson = /^docs\/qualidade\/[^/]+\.json$/
// Campos do package.json que mudam sem alterar o que é testado: dependências passam pelo
// audit do job security, e a versão só nomeia a release.
const freeManifestFields = new Set(['version', 'dependencies', 'devDependencies'])

/** `after` mantém tudo de `before`: listas só ganham itens, objetos só ganham chaves. */
export function isAdditive(before, after) {
  if (Array.isArray(before))
    return (
      Array.isArray(after) &&
      before.every((item) => after.some((candidate) => sameValue(item, candidate)))
    )
  if (before && typeof before === 'object')
    return (
      Boolean(after) &&
      typeof after === 'object' &&
      !Array.isArray(after) &&
      Object.keys(before).every(
        (key) => Object.hasOwn(after, key) && isAdditive(before[key], after[key])
      )
    )
  return Object.is(before, after)
}

// Dentro de listas o item precisa continuar idêntico: ganhar uma chave pode afrouxar a regra
// (ex.: `reason` permite pular um teste, uma exclusão a mais numa regra de SAST).
function sameValue(a, b) {
  return isAdditive(a, b) && isAdditive(b, a)
}

function parse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function manifestChanged(before, after) {
  const strip = (manifest) =>
    manifest &&
    Object.fromEntries(Object.entries(manifest).filter(([key]) => !freeManifestFields.has(key)))
  const [a, b] = [strip(parse(before)), strip(parse(after))]
  return !a || !b || !sameValue(a, b)
}

/**
 * Se a mudança pode enfraquecer a proteção. `before`/`after` são o conteúdo na base e no
 * candidato (null quando o arquivo não existe ali). Testes e código comum ficam livres: o
 * inventário obrigatório vem da base, então remover, renomear ou pular um teste listado já
 * reprova; a mutação pega assertion enfraquecida nos módulos de `mutacoes.json`.
 */
export function needsReview({ status, file }, before = null, after = null) {
  if (protectedConfig.test(file)) return true
  if (file.startsWith('docs/qualidade/')) {
    // Referências visuais e texto aparecem no diff do PR; não mudam o que é exigido.
    if (file.startsWith('docs/qualidade/visual/') || file.endsWith('.md')) return false
    if (status === 'A') return false
    if (status === 'M' && policyJson.test(file)) {
      const [a, b] = [parse(before), parse(after)]
      return a === undefined || b === undefined || !isAdditive(a, b)
    }
    return true
  }
  if (file === 'package.json') return status !== 'M' || manifestChanged(before, after)
  return false
}

// O que muda o app empacotado: processo main, preload, dependências, configuração do build e a
// própria verificação. Mudança só na interface ou na documentação não reempacota no PR.
const packagingInput =
  /^(package(-lock)?\.json$|electron-builder\.yml$|build\/|resources\/|src\/(main|preload|shared)\/|(electron\.)?vite\.config\.|scripts\/|\.github\/)/

/** Se o PR precisa empacotar e testar o pacote; fora de PR sempre precisa. */
export function packagingChanged(files, pullRequest) {
  return !pullRequest || files.some((file) => packagingInput.test(file))
}

// Recebe a saída de `git diff --name-status --no-renames`: renomear vira remoção + adição.
export function parseNameStatus(output) {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, file] = line.split('\t')
      return { status: status[0], file }
    })
}

/** Arquivos que exigem revisão. `read(entry)` devolve `{ before, after }` do arquivo. */
export function policyFiles(entries, read = () => ({})) {
  return [
    ...new Set(
      entries
        .filter((entry) => {
          const { before = null, after = null } = read(entry)
          return needsReview(entry, before, after)
        })
        .map(({ file }) => file)
    )
  ]
}

export function validatePolicyChanges(files, reviewed, bootstrap = false) {
  const sensitive = files
  requireCondition(
    bootstrap || reviewed || sensitive.length === 0,
    `Mudanças na proteção exigem revisão do SHA: ${sensitive.join(', ')}`
  )
  return sensitive
}
