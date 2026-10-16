import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function requireCondition(ok, message) {
  if (!ok) throw new Error(message)
}

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function execution(startedAt) {
  return {
    sha:
      process.env.EXPECTED_SHA ||
      execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktreeDirty:
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
    platform: process.platform,
    arch: process.arch,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    startedAt,
    finishedAt: Date.now()
  }
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
