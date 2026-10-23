import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

function versao() {
  const doDesktop = JSON.parse(readFileSync(`${raiz}../desktop/package.json`, 'utf8')).version
  let descrita = ''
  try {
    descrita = execFileSync('git', ['describe', '--tags', '--match', 'v*', '--abbrev=7'], {
      cwd: raiz,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {}
  const [, tag = doDesktop, frente, sha] = /^v(.+?)(?:-(\d+)-g([0-9a-f]+))?$/.exec(descrita) ?? []
  const [base, alpha] = tag.split('-alpha.')
  const numerica = /^\d+(\.\d+){0,2}$/.test(base) ? base : '0.0.1'
  return {
    marketing: numerica,
    build: [alpha ?? '1', frente].filter(Boolean).join('.'),
    completa: frente ? `${tag}+${frente}.${sha}` : tag
  }
}

const { marketing, build, completa } = versao()
writeFileSync(
  `${raiz}Versao.xcconfig`,
  `MARKETING_VERSION = ${marketing}\nCURRENT_PROJECT_VERSION = ${build}\nAURI_VERSAO = ${completa}\n`
)

rodar('sh', ['scripts/barekit.sh'])
rodar('xcodegen', ['generate', '--quiet'])
