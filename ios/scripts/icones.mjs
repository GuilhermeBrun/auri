import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const desktop = fileURLToPath(new URL('../../desktop/', import.meta.url))
const catalogo = `${raiz}App/Assets.xcassets`

const marca = readFileSync(`${desktop}src/renderer/src/components/ui/brand.tsx`, 'utf8')
const simbolo = marca.match(/SYMBOL_PATH =\s*'([^']+)'/)[1]

const ICONES = {
  agenda: 'calendar-days',
  pacientes: 'users',
  conexao: 'network',
  internet: 'globe',
  iphone: 'smartphone',
  avisos: 'bell',
  bloqueio: 'scan-face'
}

const json = (dados) => JSON.stringify(dados, null, 2) + '\n'

function escrever(caminho, conteudo) {
  mkdirSync(caminho.slice(0, caminho.lastIndexOf('/')), { recursive: true })
  writeFileSync(caminho, conteudo)
}

function atributos(objeto) {
  return Object.entries(objeto)
    .filter(([nome]) => nome !== 'key')
    .map(([nome, valor]) => `${nome}="${valor}"`)
    .join(' ')
}

rmSync(catalogo, { recursive: true, force: true })
escrever(`${catalogo}/Contents.json`, json({ info: { author: 'xcode', version: 1 } }))

for (const [nome, lucide] of Object.entries(ICONES)) {
  const fonte = readFileSync(`${desktop}node_modules/lucide-react/dist/esm/icons/${lucide}.mjs`, 'utf8')
  const nos = Function(`return ${fonte.match(/node: (\[[\s\S]*?\n {2}\])/)[1]}`)()
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
    'stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    nos.map(([tag, attrs]) => `<${tag} ${atributos(attrs)}/>`).join('') +
    '</svg>\n'
  escrever(`${catalogo}/${nome}.imageset/${nome}.svg`, svg)
  escrever(
    `${catalogo}/${nome}.imageset/Contents.json`,
    json({
      images: [{ filename: `${nome}.svg`, idiom: 'universal' }],
      info: { author: 'xcode', version: 1 },
      properties: { 'preserves-vector-representation': true, 'template-rendering-intent': 'template' }
    })
  )
}

escrever(
  `${catalogo}/simbolo.imageset/simbolo.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="122" height="116" viewBox="-2 -2 122 116"><path fill="#000000" d="${simbolo}"/></svg>\n`
)
escrever(
  `${catalogo}/simbolo.imageset/Contents.json`,
  json({
    images: [{ filename: 'simbolo.svg', idiom: 'universal' }],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': true, 'template-rendering-intent': 'template' }
  })
)

const escala = 5.2
const svgDoIcone = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fundo" x1="512" y1="0" x2="512" y2="1024" gradientUnits="userSpaceOnUse">
      <stop stop-color="#303039"/>
      <stop offset="0.35" stop-color="#222229"/>
      <stop offset="1" stop-color="#17171D"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#fundo)"/>
  <g transform="translate(${512 - 59.5 * escala} ${512 - 55.5 * escala}) scale(${escala})" fill="#FFFFFF">
    <path d="${simbolo}"/>
  </g>
</svg>
`
const temp = mkdtempSync(`${tmpdir()}/auri-icone-`)
try {
  writeFileSync(`${temp}/icone.svg`, svgDoIcone)
  execFileSync('qlmanage', ['-t', '-s', '1024', '-o', temp, `${temp}/icone.svg`], { stdio: 'ignore' })
  const sips = (...args) => execFileSync('sips', args, { stdio: 'ignore' })
  sips('-z', '1024', '1024', '-s', 'format', 'jpeg', '-s', 'formatOptions', '100', `${temp}/icone.svg.png`, '--out', `${temp}/icone.jpg`)
  sips('-s', 'format', 'png', `${temp}/icone.jpg`, '--out', `${temp}/icone.png`)
  mkdirSync(`${catalogo}/AppIcon.appiconset`, { recursive: true })
  renameSync(`${temp}/icone.png`, `${catalogo}/AppIcon.appiconset/icone.png`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
escrever(
  `${catalogo}/AppIcon.appiconset/Contents.json`,
  json({
    images: [{ filename: 'icone.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 }
  })
)
