import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))

const daBare = ['hyperdht', '@hyperswarm/secret-stream', 'bare-net', 'bare-crypto']

const comum = {
  absWorkingDir: raiz,
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  logLevel: 'warning',
  alias: { zod: `${raiz}node_modules/zod` }
}

await build({
  ...comum,
  entryPoints: ['worklet/index.ts'],
  outfile: 'build/worklet.cjs',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  external: daBare,
  alias: { ...comum.alias, 'node:net': 'bare-net', 'node:crypto': 'bare-crypto' }
})

await build({
  ...comum,
  entryPoints: ['worklet/teste.ts'],
  outfile: 'build/teste.cjs',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  external: daBare,
  alias: { ...comum.alias, 'node:net': 'bare-net', 'node:crypto': 'bare-crypto' }
})

await build({
  ...comum,
  entryPoints: ['scripts/servidor.ts'],
  outfile: 'build/servidor.cjs',
  platform: 'node',
  external: [...daBare, 'better-sqlite3', 'electron']
})
