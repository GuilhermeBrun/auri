import { requireCondition } from './checks.mjs'

try {
  if (process.env.GITHUB_REF_TYPE !== 'tag') {
    console.log('Build manual: gera artefatos de validação sem publicar versão.')
  } else {
    const { GITHUB_REPOSITORY, GITHUB_SHA, GH_TOKEN } = process.env
    const get = async (path) => {
      const result = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(30_000)
      })
      requireCondition(result.ok, `Não foi possível verificar release: HTTP ${result.status}`)
      return result.json()
    }
    const main = await get('commits/main')
    requireCondition(
      main.sha === GITHUB_SHA,
      'Tag de release precisa apontar para o commit atual de main'
    )
    const runs = await get(
      `actions/workflows/quality.yml/runs?event=push&branch=main&head_sha=${GITHUB_SHA}&per_page=100`
    )
    requireCondition(
      runs.workflow_runs.some(
        (run) =>
          run.head_sha === GITHUB_SHA && run.status === 'completed' && run.conclusion === 'success'
      ),
      'Release exige Qualidade aprovado no push de main desse commit'
    )
    console.log(`Release autorizada para main aprovado: ${GITHUB_SHA}`)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
