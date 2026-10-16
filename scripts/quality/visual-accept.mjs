// Traz para docs/qualidade/visual as capturas geradas pelo workflow "Referências visuais" no
// commit atual. Não faz commit: confira o diff das imagens antes de versionar.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireCondition } from './evidence.mjs'

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()
const work = mkdtempSync(join(tmpdir(), 'auri-visual-'))
try {
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
  for (const platform of ['darwin', 'win32']) {
    const target = join(work, platform)
    run('gh', [
      'run',
      'download',
      String(latest.databaseId),
      '-n',
      `referencias-${platform}`,
      '-D',
      target
    ])
    const images = readdirSync(target).filter((file) => file.endsWith('.png'))
    requireCondition(images.length > 0, `Artefato sem imagens: referencias-${platform}`)
    for (const image of images)
      cpSync(join(target, image), join('docs/qualidade/visual', platform, image))
  }
  console.log(run('git', ['status', '--short', 'docs/qualidade/visual']) || 'Nenhuma imagem mudou.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
