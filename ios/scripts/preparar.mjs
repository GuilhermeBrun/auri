import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const bin = (nome) => `${raiz}node_modules/.bin/${nome}`
const rodar = (comando, args) => execFileSync(comando, args, { cwd: raiz, stdio: 'inherit' })

rodar('node', ['scripts/construir.mjs'])

rmSync(`${raiz}App/addons`, { recursive: true, force: true })
rodar(bin('bare-link'), ['--preset', 'ios', '--out', 'App/addons', 'build/worklet.cjs'])
const addons = readdirSync(`${raiz}App/addons`)
  .filter((nome) => nome.endsWith('.xcframework'))
  .sort()
writeFileSync(
  `${raiz}App/addons/addons.yml`,
  [
    'targets:',
    '  Auri:',
    '    dependencies:',
    ...addons.map((nome) => `      - framework: ${nome}`),
    ''
  ].join('\n')
)

rodar(bin('bare-pack'), [
  '--preset',
  'ios',
  '--linked',
  '--base',
  '.',
  '--out',
  'App/app.bundle',
  'build/worklet.cjs'
])

rodar('sh', ['scripts/barekit.sh'])
rodar('xcodegen', ['generate', '--quiet'])
