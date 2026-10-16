// Roda o Vitest com o Node embutido no Electron: o better-sqlite3 é compilado
// para o Electron e não carrega no Node do sistema.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const result = spawnSync(
  electron,
  [fileURLToPath(import.meta.resolve('vite-plus/bin')), 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
)
process.exit(result.status ?? 1)
