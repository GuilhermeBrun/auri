// O CI rodando nesta máquina, parando no primeiro erro:
//
//   npm run ci:local → os passos do ci.yml (job Check). Roda sozinho antes de cada `git push`
//                      (hook em .githooks/pre-push); `git push --no-verify` pula.
//   npm run ci:mac   → os passos do workflow Windows, no Mac: o Auri aberto de verdade (E2E), a
//                      interface, o pacote e o instalador. O Mac é testado aqui, não no Actions,
//                      onde o minuto do Mac custa 10x o do Linux. Rodar antes de cada estável.
import { spawnSync } from 'node:child_process'

const profiles = {
  local: [
    { name: 'Lint: formato, lint e tipos', command: 'npm', args: ['run', 'check'] },
    { name: 'Lint: código não usado', command: 'npm', args: ['run', 'knip'] },
    { name: 'Build', command: 'npm', args: ['run', 'build'] },
    { name: 'Test', command: 'npm', args: ['test'] },
    { name: 'Release Smoke', command: 'node', args: ['--test', 'scripts/release/*.test.mjs'] }
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
for (const { name, command, args, env } of steps) {
  console.log(`\n▶ ${name}`)
  const start = Date.now()
  const { status } = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
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
