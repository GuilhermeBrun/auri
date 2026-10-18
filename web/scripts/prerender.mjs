// Depois do `vp build` (cliente) e do `vp build --ssr` (servidor): grava o HTML da página em
// dist/index.html, para ela aparecer inteira antes do script (e sem ele).
//
// As releases vêm, nesta ordem, de:
//   AURI_RELEASES=exemplo | <arquivo> | <url>   escolha explícita (`npm run build:exemplo`)
//   releases.json                               gravado pelo workflow Release antes do build
//   https://atualizacoes.auri.dev.br/releases.json   publicado no Pages (build da Vercel)
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'

const PUBLISHED = 'https://atualizacoes.auri.dev.br/releases.json'

async function releases() {
  const source =
    process.env.AURI_RELEASES || (existsSync('releases.json') ? 'releases.json' : PUBLISHED)
  if (source === 'exemplo') return JSON.parse(await readFile('releases.exemplo.json', 'utf8'))
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, 'utf8'))
  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source} respondeu ${response.status}.`)
  return response.json()
}

const { render } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)
const { info, html } = render(await releases())
// `<` escapado: o JSON vai dentro de um <script>
const data = JSON.stringify(info).replaceAll('<', '\\u003c')
const template = await readFile('dist/index.html', 'utf8')
const page = template
  .replace('<title>Baixar o Auri</title>', `<title>Baixar o Auri ${info.version}</title>`)
  .replace('<!--app-html-->', html)
  .replace('<!--app-data-->', `<script type="application/json" id="download-info">${data}</script>`)
await writeFile('dist/index.html', page)
await rm('dist-ssr', { recursive: true, force: true })
console.log(`dist/index.html: Auri ${info.version}${info.isAlpha ? ' (alpha)' : ''}`)
