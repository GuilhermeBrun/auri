import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { latestTags, nextAlpha, outsideApp, stableFromAlpha } from './versions.mjs'

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

try {
  const [command] = process.argv.slice(2)
  if (command === 'resolve') resolve()
  else throw new Error(`Comando desconhecido: ${command}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
