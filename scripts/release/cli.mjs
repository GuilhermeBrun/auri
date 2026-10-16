// Usado pelo workflow Release:
//   node scripts/release/cli.mjs resolve      → saídas skip, ref, version, tag, prerelease
//   node scripts/release/cli.mjs site <pasta> → baixa os arquivos das releases e monta o site
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { latestTags, nextBeta, siteFiles, stableFromBeta } from './versions.mjs'

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()
const lines = (text) => text.split('\n').filter(Boolean)

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`)
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
}

function resolve() {
  const tagNames = lines(run('git', ['tag', '--list', 'v*']))
  const commitOf = (tag) => run('git', ['rev-list', '-n', '1', tag])
  const { beta } = latestTags(tagNames)

  if (process.env.CHANNEL === 'stable') {
    const version = stableFromBeta({
      tagNames,
      betaTag: beta,
      requested: process.env.VERSION_INPUT
    })
    return output({
      skip: false,
      ref: commitOf(beta),
      version,
      tag: `v${version}`,
      prerelease: false
    })
  }

  const head = run('git', ['rev-parse', 'HEAD'])
  if (beta && commitOf(beta) === head) {
    console.log(`O main não mudou desde o ${beta}.`)
    return output({ skip: true })
  }
  const { version: stableFallback } = JSON.parse(readFileSync('package.json', 'utf8'))
  const version = nextBeta({ tagNames, stableFallback, date: new Date() })
  output({ skip: false, ref: head, version, tag: `v${version}`, prerelease: true })
}

function site(directory) {
  const releases = JSON.parse(
    run('gh', ['release', 'list', '--limit', '100', '--json', 'tagName,isDraft'])
  ).filter((release) => !release.isDraft)
  const { stable, beta } = latestTags(releases.map((release) => release.tagName))
  const withAssets = (tag) =>
    tag && {
      tag,
      assets: JSON.parse(run('gh', ['release', 'view', tag, '--json', 'assets'])).assets.map(
        (asset) => asset.name
      )
    }
  const files = siteFiles({ stable: withAssets(stable), beta: withAssets(beta) })

  mkdirSync(directory, { recursive: true })
  for (const { name, tag } of files) {
    run('gh', ['release', 'download', tag, '--pattern', name, '--dir', directory, '--clobber'])
  }
  const links = (tag) =>
    files
      .filter((file) => file.tag === tag && /\.(exe|dmg)$/.test(file.name))
      .map((file) => `<li><a href="${file.name}">${file.name}</a></li>`)
      .join('')
  const betaShown = files.some((file) => file.tag === beta && file.tag !== stable)
  writeFileSync(
    join(directory, 'index.html'),
    [
      '<!doctype html><html lang="pt-BR"><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>Auri ${stable ? stable.slice(1) : ''}</title>`,
      '<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px">',
      stable ? `<h1>Auri ${stable.slice(1)}</h1><ul>${links(stable)}</ul>` : '',
      betaShown ? `<h2>Beta ${beta.slice(1)}</h2><ul>${links(beta)}</ul>` : '',
      `<p>No ${files.some((file) => file.name === 'latest-mac.yml') ? 'Windows e no Mac' : 'Windows'} o Auri instalado se atualiza sozinho. O beta é opcional, em Configurações.</p>`,
      '</body></html>'
    ].join('\n')
  )
  console.log(files.map((file) => `${file.name} ← ${file.tag}`).join('\n'))
}

try {
  const [command, argument] = process.argv.slice(2)
  if (command === 'resolve') resolve()
  else if (command === 'site') site(argument ?? 'site')
  else throw new Error(`Comando desconhecido: ${command}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
