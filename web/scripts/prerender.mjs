// Depois do `vp build` (cliente) e do `vp build --ssr` (servidor): grava o HTML da página em
// dist/index.html, para ela aparecer inteira antes do script (e sem ele).
//
// As releases vêm, nesta ordem, de:
//   `node scripts/prerender.mjs exemplo` ou AURI_RELEASES=exemplo | <arquivo> | <url>
//   releases.json            gravado pelo workflow Release antes do build
//   o releases.json publicado no Vercel Blob pelo workflow Release
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'

const PUBLISHED = [
  'https://tmjyk19jrikg8aex.public.blob.vercel-storage.com/releases.json',
  'https://atualizacoes.auri.dev.br/releases.json'
]

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}.`)
  return response.json()
}

async function releases() {
  const source = process.argv[2] || process.env.AURI_RELEASES
  if (source === 'exemplo') return JSON.parse(await readFile('releases.exemplo.json', 'utf8'))
  if (source && /^https?:\/\//.test(source)) return fetchJson(source)
  if (source) return JSON.parse(await readFile(source, 'utf8'))
  if (existsSync('releases.json')) return JSON.parse(await readFile('releases.json', 'utf8'))
  const errors = []
  for (const url of PUBLISHED) {
    try {
      return await fetchJson(url)
    } catch (error) {
      errors.push(error.message)
    }
  }
  // Sem as releases de verdade, o build para: melhor que publicar a página com outra versão.
  throw new Error(`Não consegui ler o releases.json publicado:\n${errors.join('\n')}`)
}

/** Troca o marcador (que precisa existir) pelo texto, sem os padrões especiais do replace. */
function fill(html, marker, value) {
  if (!html.includes(marker)) throw new Error(`dist/index.html sem o marcador ${marker}.`)
  return html.replace(marker, () => value)
}

const { render } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)
const { info, html } = render(await releases())
// `<` escapado: o JSON vai dentro de um <script>
const data = JSON.stringify(info).replaceAll('<', '\\u003c')
let page = await readFile('dist/index.html', 'utf8')
page = fill(page, '<title>Baixar o Auri</title>', `<title>Baixar o Auri ${info.version}</title>`)
page = fill(page, '<!--app-html-->', html)
page = fill(
  page,
  '<!--app-data-->',
  `<script type="application/json" id="download-info">${data}</script>`
)
await writeFile('dist/index.html', page)
await rm('dist-ssr', { recursive: true, force: true })
console.log(`dist/index.html: Auri ${info.version}${info.isAlpha ? ' (alpha)' : ''}`)
