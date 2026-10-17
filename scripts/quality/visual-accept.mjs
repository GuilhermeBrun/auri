// Traz para docs/qualidade/visual as capturas do commit atual: as do Windows, geradas pelo workflow
// "Referências visuais", e as do Mac, geradas aqui (roda no Mac). Não faz commit: confira o diff
// das imagens antes de versionar.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireCondition } from './evidence.mjs'

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()
const work = mkdtempSync(join(tmpdir(), 'auri-visual-'))

function accept(platform, source) {
  const images = readdirSync(source).filter((file) => file.endsWith('.png'))
  requireCondition(images.length > 0, `Sem imagens de ${platform} em ${source}`)
  for (const image of images)
    cpSync(join(source, image), join('docs/qualidade/visual', platform, image))
}

try {
  requireCondition(
    process.platform === 'darwin',
    'Rode no Mac: as capturas do Mac são geradas nesta máquina.'
  )
  const head = run('git', ['rev-parse', 'HEAD'])
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const [latest] = JSON.parse(
    run('gh', [
      'run',
      'list',
      '--workflow',
      'referencias-visuais.yml',
      '--branch',
      branch,
      '--status',
      'success',
      '--limit',
      '1',
      '--json',
      'databaseId,headSha'
    ])
  )
  requireCondition(
    latest,
    `Nenhuma geração aprovada em ${branch}. Rode: gh workflow run referencias-visuais.yml --ref ${branch}`
  )
  requireCondition(
    latest.headSha === head,
    `As capturas são de ${latest.headSha.slice(0, 7)}, não do commit atual ${head.slice(0, 7)}: gere de novo depois do push.`
  )
  const target = join(work, 'win32')
  run('gh', ['run', 'download', String(latest.databaseId), '-n', 'referencias-win32', '-D', target])
  accept('win32', target)

  // Sem sobras de uma geração anterior (uma tela que saiu não volta para docs/).
  rmSync('.quality/ui/reference/darwin', { recursive: true, force: true })
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
  execFileSync('npm', ['run', 'test:ui'], {
    stdio: 'inherit',
    env: { ...process.env, AURI_UPDATE_VISUAL: '1' }
  })
  accept('darwin', '.quality/ui/reference/darwin')

  console.log(run('git', ['status', '--short', 'docs/qualidade/visual']) || 'Nenhuma imagem mudou.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
