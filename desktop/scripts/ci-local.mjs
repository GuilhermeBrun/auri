// O CI rodando nesta máquina, parando no primeiro erro:
//
//   npm run ci:local → os passos do ci.yml (job Check). Roda sozinho antes de cada `git push`
//                      (hook em desktop/.vite-hooks/pre-push); `git push --no-verify` pula.
//   npm run ci:mac   → os passos do workflow Windows, no Mac: o Auri aberto de verdade (E2E), a
//                      interface, o pacote e o instalador. O Mac é testado aqui, não no Actions,
//                      onde o minuto do Mac custa 10x o do Linux. Rodar antes de cada estável.
//
// No `local`, os passos com `cached` rodam pelo `vp run --cache` do Vite+: se nada que o passo lê
// mudou desde a última vez que ele passou, a saída é repetida sem rodar de novo. O CI do Actions
// roda sem cache. Para zerar: `npx vp cache clean` (em desktop/ e em web/).
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'

// O npm grava node_modules/.package-lock.json ao instalar: mais novo que o package-lock.json, a
// instalação é a do lockfile atual (trocar de branch ou mudar dependências muda o package-lock.json).
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
    // O site (web/), como no job Check
    // Sem `npm ci` se o node_modules já é o do lockfile: ele apaga a pasta, e o cache do Vite+ com ela
    { name: 'Site: dependências', command: 'npm', args: ['ci'], cwd: '../web', skip: installed },
    { name: 'Site: formato, lint e tipos', cached: 'check', cwd: '../web' },
    { name: 'Site: testes', cached: 'test', cwd: '../web' },
    { name: 'Site: build', cached: 'build:exemplo', cwd: '../web' }
  ],
  mac: [
    // Sem instaladores de versões anteriores: a conferência do instalador espera um só.
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
// O vp de cada pasta (sem workspaces, cada uma tem o seu node_modules)
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
    // O shell só para o npm do Windows (npm.cmd); o node é chamado direto
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
