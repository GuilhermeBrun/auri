import assert from 'node:assert/strict'
import { test } from 'node:test'
import { downloadPage } from './page.mjs'
import { siteFiles } from './versions.mjs'

const release = (tag, assets) => ({
  tag,
  publishedAt: '2026-10-17T17:52:14Z',
  assets: assets.map((name) => ({ name, size: 106361517 }))
})
const stable = release('v1.1.0', [
  'latest.yml',
  'latest-mac.yml',
  'alpha.yml',
  'auri-1.1.0-setup.exe',
  'auri-1.1.0-arm64.dmg',
  'Auri-1.1.0-arm64-mac.zip'
])
const alpha = release('v1.1.1-alpha.20261021.3', [
  'alpha.yml',
  'auri-1.1.1-alpha.20261021.3-setup.exe'
])
const page = (s, a) => {
  const names = (r) => r && { tag: r.tag, assets: r.assets.map((asset) => asset.name) }
  return downloadPage({
    stable: s,
    alpha: a,
    files: siteFiles({ stable: names(s), alpha: names(a) })
  })
}

await test('estável: Windows em primeiro, Mac ao lado, sem seção do alpha', () => {
  const html = page(stable, null)
  assert.match(html, /<title>Baixar o Auri 1\.1\.0<\/title>/)
  assert.ok(html.indexOf('auri-1.1.0-setup.exe') < html.indexOf('auri-1.1.0-arm64.dmg'))
  assert.match(html, /btn-primary" href="auri-1\.1\.0-setup\.exe"/)
  assert.match(html, /btn-secondary" href="auri-1\.1\.0-arm64\.dmg"/)
  assert.match(html, /101 MB/)
  assert.match(html, /17 de outubro de 2026/)
  assert.doesNotMatch(html, /Versão alpha/)
  assert.match(html, /data-os-switch hidden/)
  assert.doesNotMatch(html, /Ainda não há/)
})

await test('com um alpha mais novo, a página continua mostrando só a estável', () => {
  const html = page(stable, alpha)
  assert.match(html, /<title>Baixar o Auri 1\.1\.0<\/title>/)
  assert.doesNotMatch(html, /alpha\.20261021/)
})

await test('só alpha: o topo mostra o alpha e diz que não há Mac', () => {
  const html = page(null, alpha)
  assert.match(html, /<span class="chip">Alpha<\/span>/)
  assert.match(html, /Ainda não há versão para Mac\./)
  assert.doesNotMatch(html, /\.dmg"/)
  assert.doesNotMatch(html, /data-os-switch/)
  assert.doesNotMatch(html, /Versão alpha<\/h2>/)
})

await test('nomes de arquivo vão escapados', () => {
  const odd = release('v1.0.0', ['latest.yml', 'auri-"1"<b>-setup.exe'])
  const html = page(odd, null)
  assert.match(html, /href="auri-&quot;1&quot;&lt;b&gt;-setup\.exe"/)
})
