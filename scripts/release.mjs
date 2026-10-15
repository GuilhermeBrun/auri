// Cria e envia a tag da versão do package.json no commit atual de main. A tag dispara o Build,
// que gera, testa e publica a release. A versão sobe antes, num PR comum:
//   npm version minor --no-git-tag-version
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { validateRelease } from './quality/extended-checks.mjs'

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()

try {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  const tag = `v${version}`
  if (run('git', ['status', '--porcelain', '--untracked-files=no']))
    throw new Error('Há mudanças não commitadas.')
  run('git', ['fetch', '--quiet', 'origin', 'main', '--tags'])
  const head = run('git', ['rev-parse', 'HEAD'])
  if (run('git', ['tag', '--list', tag])) throw new Error(`A tag ${tag} já existe: suba a versão.`)
  const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
  const runs = JSON.parse(
    run('gh', [
      'api',
      `repos/${repo}/actions/workflows/quality.yml/runs?event=push&branch=main&head_sha=${head}&per_page=100`
    ])
  ).workflow_runs
  // As mesmas regras que o Build confere: commit atual de main, aprovado no push.
  validateRelease(run('git', ['rev-parse', 'origin/main']), head, tag, version, runs)
  run('git', ['tag', '--annotate', tag, '--message', `Auri ${version}`])
  run('git', ['push', 'origin', tag])
  console.log(
    `Tag ${tag} enviada. Acompanhe: https://github.com/${repo}/actions/workflows/build.yml`
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
