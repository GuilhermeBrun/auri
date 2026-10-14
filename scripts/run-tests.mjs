// Roda o Vitest com o Node embutido no Electron: o better-sqlite3 é compilado
// para o Electron e não carrega no Node do sistema.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const quality = process.argv.includes('--quality')
const args = process.argv.slice(2).filter((arg) => arg !== '--quality')
const startedAt = Date.now()
if (quality) {
  mkdirSync('.quality', { recursive: true })
  for (const file of ['tests.json', 'junit.xml', 'test-run.json']) {
    rmSync(`.quality/${file}`, { force: true })
  }
}
const result = spawnSync(
  electron,
  [fileURLToPath(import.meta.resolve('vite-plus/bin')), 'test', ...args],
  {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', AURI_QUALITY: quality ? '1' : '0' }
  }
)
if (quality) {
  writeFileSync(
    '.quality/test-run.json',
    JSON.stringify({
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      worktreeDirty:
        execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
      root: process.cwd(),
      platform: process.platform,
      arch: process.arch,
      runId: process.env.GITHUB_RUN_ID || null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      startedAt,
      finishedAt: Date.now(),
      exitCode: result.status ?? 1
    })
  )
}
process.exit(result.status ?? 1)
