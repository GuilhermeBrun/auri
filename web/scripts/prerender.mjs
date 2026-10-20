import { readFile, rm, writeFile } from 'node:fs/promises'

const server = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)
const { REPO, downloadUrl, feedSources, newestAlpha, releasesFrom, render, rewriteYml } = server

const timeout = () => AbortSignal.timeout(15_000)

async function fetchOk(url, init) {
  const response = await fetch(url, { signal: timeout(), ...init })
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}.`)
  return response
}

async function latestStable() {
  const response = await fetch(`${REPO}/releases/latest`, { redirect: 'manual', signal: timeout() })
  const location = response.headers.get('location') ?? ''
  const tag = /\/releases\/tag\/([^/?#]+)$/.exec(location)?.[1]
  return tag ? decodeURIComponent(tag) : null
}

async function yml(tag, name) {
  const response = await fetch(downloadUrl(tag, name), { signal: timeout() })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${name} de ${tag} respondeu ${response.status}.`)
  return response.text()
}

async function fromGitHub() {
  const [stable, atom] = await Promise.all([
    latestStable(),
    fetchOk(`${REPO}/releases.atom`).then((response) => response.text())
  ])
  const alpha = newestAlpha(atom)
  const feed = []
  for (const { name, tags } of feedSources(stable, alpha)) {
    for (const tag of tags) {
      const text = await yml(tag, name)
      if (text === null) continue
      feed.push({ name, tag, text })
      await writeFile(`dist/${name}`, rewriteYml(text, tag))
      break
    }
  }
  if (!feed.some((file) => file.name === 'latest.yml' || file.name === 'alpha.yml')) {
    throw new Error(
      `Nenhum latest.yml ou alpha.yml nas releases (estável ${stable}, alpha ${alpha}).`
    )
  }
  const releases = releasesFrom(feed, stable, alpha)
  await writeFile('dist/releases.json', `${JSON.stringify(releases, null, 2)}\n`)
  console.log(feed.map((file) => `${file.name} ← ${file.tag}`).join('\n'))
  return releases
}

async function releases() {
  const source = process.argv[2] || process.env.AURI_RELEASES
  if (source === 'exemplo') return JSON.parse(await readFile('releases.exemplo.json', 'utf8'))
  if (source && /^https?:\/\//.test(source)) return (await fetchOk(source)).json()
  if (source) return JSON.parse(await readFile(source, 'utf8'))
  return fromGitHub()
}

function fill(html, marker, value) {
  if (!html.includes(marker)) throw new Error(`dist/index.html sem o marcador ${marker}.`)
  return html.replace(marker, () => value)
}

const { info, html } = render(await releases())
const data = JSON.stringify(info).replaceAll('<', '\\u003c')
let page = await readFile('dist/index.html', 'utf8')
page = fill(page, '<!--app-html-->', html)
page = fill(
  page,
  '<!--app-data-->',
  `<script type="application/json" id="download-info">${data}</script>`
)
await writeFile('dist/index.html', page)
await rm('dist-ssr', { recursive: true, force: true })
console.log(`dist/index.html: Auri ${info.version}${info.isAlpha ? ' (alpha)' : ''}`)
