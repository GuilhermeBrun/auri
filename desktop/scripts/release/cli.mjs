// Usado pelo workflow Release:
//   node scripts/release/cli.mjs resolve      → saídas skip, ref, version, tag, prerelease
//   node scripts/release/cli.mjs site <pasta> → baixa os arquivos das releases e monta o site
import { execFileSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { downloadPage } from './page.mjs'
import { latestTags, nextAlpha, outsideApp, siteFiles, stableFromAlpha } from './versions.mjs'

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
  const { alpha } = latestTags(tagNames)

  if (process.env.CHANNEL === 'stable') {
    const version = stableFromAlpha({
      tagNames,
      alphaTag: alpha,
      requested: process.env.VERSION_INPUT
    })
    return output({
      skip: false,
      ref: commitOf(alpha),
      version,
      tag: `v${version}`,
      prerelease: false
    })
  }

  const head = run('git', ['rev-parse', 'HEAD'])
  if (alpha && commitOf(alpha) === head) {
    console.log(`O main não mudou desde o ${alpha}.`)
    return output({ skip: true })
  }
  if (alpha && outsideApp(lines(run('git', ['diff', '--name-only', commitOf(alpha), head])))) {
    console.log(`Desde o ${alpha} o main não mudou o Auri (só documentação ou o site).`)
    return output({ skip: true })
  }
  const { version: firstVersion } = JSON.parse(readFileSync('package.json', 'utf8'))
  const version = nextAlpha({ tagNames, firstVersion, date: new Date() })
  output({ skip: false, ref: head, version, tag: `v${version}`, prerelease: true })
}

function site(directory) {
  const releases = JSON.parse(
    run('gh', ['release', 'list', '--limit', '100', '--json', 'tagName,isDraft'])
  ).filter((release) => !release.isDraft)
  const { stable, alpha } = latestTags(releases.map((release) => release.tagName))
  const details = (tag) =>
    tag && {
      tag,
      ...JSON.parse(run('gh', ['release', 'view', tag, '--json', 'assets,publishedAt']))
    }
  const [stableRelease, alphaRelease] = [details(stable), details(alpha)]
  const names = (release) =>
    release && { tag: release.tag, assets: release.assets.map((asset) => asset.name) }
  const files = siteFiles({ stable: names(stableRelease), alpha: names(alphaRelease) })

  mkdirSync(directory, { recursive: true })
  for (const { name, tag } of files) {
    run('gh', ['release', 'download', tag, '--pattern', name, '--dir', directory, '--clobber'])
  }
  cpSync(join(import.meta.dirname, 'site-assets'), directory, { recursive: true })
  writeFileSync(
    join(directory, 'index.html'),
    downloadPage({ stable: stableRelease, alpha: alphaRelease, files })
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
