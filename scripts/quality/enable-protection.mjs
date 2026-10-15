import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireCondition } from './checks.mjs'

const api = (path, args = []) =>
  JSON.parse(execFileSync('gh', ['api', path, ...args], { encoding: 'utf8' }))
const work = mkdtempSync(join(tmpdir(), 'auri-branch-quality-'))
try {
  const repo = JSON.parse(
    execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'], {
      encoding: 'utf8'
    })
  )
  const branch = repo.defaultBranchRef.name
  requireCondition(branch === 'main', 'Confira o destino: a branch padrão não é main.')
  const head = api(`repos/${repo.nameWithOwner}/commits/${branch}`).sha
  const app = api('apps/github-actions')
  const checks = api(
    `repos/${repo.nameWithOwner}/commits/${head}/check-runs?per_page=100&filter=latest`
  )
  requireCondition(
    checks.check_runs.some(
      (check) =>
        check.name === 'quality' &&
        check.app.id === app.id &&
        check.status === 'completed' &&
        check.conclusion === 'success'
    ),
    'Publique o workflow e aguarde quality aprovado no HEAD remoto de main antes de exigir esse check.'
  )
  const existing = api(`repos/${repo.nameWithOwner}/branches/${branch}`)
  requireCondition(
    !existing.protected,
    'Branch já protegida: revise a regra existente antes de alterar; este comando não a substitui.'
  )
  const payload = {
    // Sem exigir base atualizada: mantenedor solo; o push em main roda o Qualidade de novo.
    required_status_checks: { strict: false, checks: [{ context: 'quality', app_id: app.id }] },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 0
    },
    restrictions: null,
    required_conversation_resolution: true,
    allow_force_pushes: false,
    allow_deletions: false
  }
  const file = join(work, 'protection.json')
  writeFileSync(file, JSON.stringify(payload))
  api(`repos/${repo.nameWithOwner}/branches/${branch}/protection`, [
    '--method',
    'PUT',
    '--input',
    file
  ])
  const verified = api(`repos/${repo.nameWithOwner}/branches/${branch}/protection`)
  requireCondition(
    verified.enforce_admins.enabled &&
      verified.required_status_checks.checks.some(
        (check) => check.context === 'quality' && check.app_id === app.id
      ),
    'Não foi possível confirmar a proteção aplicada.'
  )
  console.log(`Proteção confirmada: ${repo.nameWithOwner}/${branch}, check quality obrigatório.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
