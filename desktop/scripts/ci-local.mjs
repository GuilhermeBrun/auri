import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'

const installed = (cwd) => {
  const modified = (file) => statSync(resolve(cwd, file), { throwIfNoEntry: false })?.mtimeMs
  return (modified('node_modules/.package-lock.json') ?? 0) > (modified('package-lock.json') ?? 0)
}

const profiles = {
  local: [
    { name: 'Lint: formato, lint e tipos', cached: 'check' },
    { name: 'Lint: código não usado', cached: 'knip' },
    { name: 'Build', command: 'npm', args: ['run', 'build'] },
    { name: 'Test', cached: 'test' },
    { name: 'Release Smoke', command: 'node', args: ['--test', 'scripts/release/*.test.mjs'] },
    { name: 'Site: dependências', command: 'npm', args: ['ci'], cwd: '../web', skip: installed },
    { name: 'Site: formato, lint e tipos', cached: 'check', cwd: '../web' },
    { name: 'Site: testes', cached: 'test', cwd: '../web' },
    { name: 'Site: build', cached: 'build:exemplo', cwd: '../web' }
  ],
  mac: [
    {
      name: 'Limpar dist',
      command: 'node',
      args: ['-e', "require('fs').rmSync('dist', { recursive: true, force: true })"]
    },
    { name: 'Test', command: 'npm', args: ['test'] },
    {
      name: 'Instaladores oficiais das nuvens (download e assinatura)',
      command: 'npm',
      args: ['test', '--', 'src/main/backup/installer.test.ts'],
      env: { AURI_TESTA_INSTALADORES: '1' }
    },
    { name: 'Build', command: 'npm', args: ['run', 'build'] },
    { name: 'E2E', command: 'npm', args: ['run', 'test:e2e'] },
    { name: 'Interface', command: 'npm', args: ['run', 'test:ui'] },
    { name: 'Pacote', command: 'npm', args: ['run', 'build:unpack'] },
    { name: 'Pacote: conferência', command: 'npm', args: ['run', 'test:package'] },
    { name: 'Instalador', command: 'npm', args: ['run', 'build:mac'] },
    { name: 'Instalador: conferência', command: 'npm', args: ['run', 'test:installer'] }
  ]
}

const profile = process.argv[2] ?? 'local'
const steps = profiles[profile]
if (!steps) throw new Error(`Perfil desconhecido: ${profile}`)
if (profile === 'mac' && process.platform !== 'darwin') {
  console.error('O `npm run ci:mac` testa o Auri no Mac: rode num Mac.')
  process.exit(1)
}

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim()
const pending = git('status', '--porcelain', '--untracked-files=no')
if (pending) {
  console.warn(
    '\n⚠ Há alterações sem commit: o CI local valida a pasta como está, não só o que vai no push.\n'
  )
}

const results = []
const vitePlusRun = (cwd = '.', script) => ({
  command: process.execPath,
  args: [resolve(cwd, 'node_modules/vite-plus/bin/vp'), 'run', '--cache', script]
})

for (const step of steps) {
  const { name, env, cwd } = step
  if (step.skip?.(cwd)) {
    console.log(`\n▶ ${name}: já em dia`)
    results.push(`✓ ${name} (já em dia)`)
    continue
  }
  const { command, args } = step.cached ? vitePlusRun(cwd, step.cached) : step
  console.log(`\n▶ ${name}`)
  const start = Date.now()
  const { status } = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && !step.cached,
    cwd,
    env: { ...process.env, ...env }
  })
  const seconds = Math.round((Date.now() - start) / 1000)
  results.push(`${status === 0 ? '✓' : '✗'} ${name} (${seconds}s)`)
  if (status !== 0) break
}

console.log(`\nCI ${profile} em ${git('rev-parse', '--short', 'HEAD')}:\n${results.join('\n')}`)
if (results.at(-1).startsWith('✗')) {
  console.error(
    profile === 'local'
      ? '\nCI local reprovou. Corrija antes do push, ou use `git push --no-verify`.'
      : '\nCI do Mac reprovou.'
  )
  process.exit(1)
}
