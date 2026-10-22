import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const desktop = fileURLToPath(new URL('../../desktop/', import.meta.url))
const { default: electron } = await import(`${desktop}node_modules/electron/index.js`)

const resultado = spawnSync(electron, ['build/servidor.cjs', ...process.argv.slice(2)], {
  cwd: raiz,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: `${desktop}node_modules` }
})
process.exit(resultado.status ?? 1)
