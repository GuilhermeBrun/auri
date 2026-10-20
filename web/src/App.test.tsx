import { renderToString } from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'
import { App } from './App'
import { downloadInfo, type Release } from './releases'

const release = (tag: string, names: string[]): Release => ({
  tag,
  publishedAt: '2026-10-17T17:52:14Z',
  assets: names.map((name) => ({ name, size: 106361517 }))
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
const files = (...releases: (Release | null)[]) =>
  releases.flatMap((r) => (r ? r.assets.map(({ name }) => ({ name, tag: r.tag })) : []))

const page = (s: Release | null, a: Release | null) =>
  renderToString(<App info={downloadInfo({ stable: s, alpha: a, files: files(s, a) })} />)

describe('página de download (HTML sem script)', () => {
  test('estável: Windows em primeiro, Mac ao lado, seletor escondido', () => {
    const html = page(stable, null)
    expect(html.indexOf('auri-1.1.0-setup.exe')).toBeLessThan(html.indexOf('auri-1.1.0-arm64.dmg'))
    expect(html).toMatch(
      /btn-primary" href="https:\/\/github\.com\/GuilhermeBrun\/auri\/releases\/download\/v1\.1\.0\/auri-1\.1\.0-setup\.exe"/
    )
    expect(html).toMatch(
      /btn-secondary" href="https:\/\/github\.com\/GuilhermeBrun\/auri\/releases\/download\/v1\.1\.0\/auri-1\.1\.0-arm64\.dmg"/
    )
    expect(html).toContain('101 MB')
    expect(html).toContain('Versão 1.1.0 · 17 de outubro de 2026')
    expect(html).toMatch(/data-os-switch="" hidden=""/)
    expect(html).not.toContain('Ainda não há')
    expect(html).not.toContain('class="chip"')
  })

  test('com um alpha mais novo, a página continua mostrando só a estável', () => {
    const html = page(stable, alpha)
    expect(html).toContain('Versão 1.1.0')
    expect(html).not.toContain('alpha.20261021')
  })

  test('só alpha: mostra o alpha e diz que não há Mac', () => {
    const html = page(null, alpha)
    expect(html).toContain('<span class="chip">Alpha</span>')
    expect(html).toContain('Ainda não há versão para Mac.')
    expect(html).not.toMatch(/\.dmg"/)
    expect(html).not.toContain('data-os-switch')
  })

  test('nomes de arquivo vão codificados no endereço', () => {
    const odd = release('v1.0.0', ['latest.yml', 'auri-"1"<b>-setup.exe'])
    expect(page(odd, null)).toContain('/v1.0.0/auri-%221%22%3Cb%3E-setup.exe"')
  })

  test('a prévia da agenda vem pronta, com a semana de 19 a 24 de outubro', () => {
    const html = page(stable, null)
    expect(html).toContain('19 a 24 de outubro 2026')
    expect(html).toContain('Alice Costa')
  })
})

test('o alpha mais novo que a estável fica disponível para escolher', () => {
  const info = downloadInfo({ stable, alpha, files: files(stable, alpha) })
  expect(info.version).toBe('1.1.0')
  expect(info.alpha?.options.map((option) => option.name)).toEqual([
    'auri-1.1.1-alpha.20261021.3-setup.exe'
  ])
  const older = release('v1.0.9-alpha.20261001.1', ['alpha.yml', 'auri-1.0.9-setup.exe'])
  expect(downloadInfo({ stable, alpha: older, files: files(stable, older) }).alpha).toBeNull()
  expect(downloadInfo({ stable: null, alpha, files: files(alpha) }).alpha).toBeNull()
})

test('sem estável nem alpha, o build falha', () => {
  expect(() => downloadInfo({ stable: null, alpha: null, files: [] })).toThrow(/sem estável/)
})
