// O CI do GitHub (ci.yml) rodando nesta máquina: os mesmos passos dos jobs Lint, Build, Test e
// Release Smoke, na mesma ordem. Roda sozinho antes de cada `git push` (hook em .githooks/pre-push);
// `git push --no-verify` pula.
import { spawnSync } from 'node:child_process'

const steps = [
  { name: 'Lint: formato, lint e tipos', command: 'npm', args: ['run', 'check'] },
  { name: 'Lint: código não usado', command: 'npm', args: ['run', 'knip'] },
  { name: 'Build', command: 'npm', args: ['run', 'build'] },
  { name: 'Test', command: 'npm', args: ['test'] },
  { name: 'Release Smoke', command: 'node', args: ['--test', 'scripts/release/*.test.mjs'] }
]

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim()
const pending = git('status', '--porcelain', '--untracked-files=no')
if (pending) {
  console.warn(
    '\n⚠ Há alterações sem commit: o CI local valida a pasta como está, não só o que vai no push.\n'
  )
}

const results = []
for (const { name, command, args } of steps) {
  console.log(`\n▶ ${name}`)
  const start = Date.now()
  const { status } = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  const seconds = Math.round((Date.now() - start) / 1000)
  results.push(`${status === 0 ? '✓' : '✗'} ${name} (${seconds}s)`)
  if (status !== 0) break
}

console.log(`\nCI local em ${git('rev-parse', '--short', 'HEAD')}:\n${results.join('\n')}`)
if (results.at(-1).startsWith('✗')) {
  console.error('\nCI local reprovou. Corrija antes do push, ou use `git push --no-verify`.')
  process.exit(1)
}
