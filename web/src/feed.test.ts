import { describe, expect, test } from 'vite-plus/test'
import { feedSources, isNewer, newestAlpha, readYml, releasesFrom, rewriteYml } from './feed'

const LATEST = `version: 0.0.1
files:
  - url: auri-0.0.1-setup.exe
    sha512: abc
    size: 106361517
path: auri-0.0.1-setup.exe
sha512: abc
releaseDate: '2026-10-17T17:51:38.214Z'
`
const MAC = `version: 0.0.1
files:
  - url: Auri-0.0.1-arm64-mac.zip
    sha512: def
    size: 123945973
  - url: auri-0.0.1-arm64.dmg
    sha512: ghi
    size: 124067986
  - url: auri-0.0.1-arm64.dmg
    sha512: ghi
    size: 124067986
path: Auri-0.0.1-arm64-mac.zip
sha512: def
releaseDate: '2026-10-17T17:52:10.000Z'
`
const ALPHA = LATEST.replaceAll('0.0.1', '0.0.2-alpha.20261019.1').replace(
  '2026-10-17',
  '2026-10-19'
)

describe('versões', () => {
  test('o alpha da próxima versão é mais novo que a estável, o da mesma não', () => {
    expect(isNewer('v0.0.2-alpha.20261019.1', 'v0.0.1')).toBe(true)
    expect(isNewer('v0.0.1-alpha.20261017.1', 'v0.0.1')).toBe(false)
    expect(isNewer('v0.0.1', 'v0.0.1')).toBe(false)
    expect(isNewer('v0.0.2-alpha.20261019.2', 'v0.0.2-alpha.20261019.1')).toBe(true)
    expect(() => isNewer('main', 'v0.0.1')).toThrow(/Tag inválida/)
  })

  test('o alpha mais novo do releases.atom, contando os beta antigos', () => {
    const atom = [
      'v0.0.2-alpha.20261018.1',
      'v0.0.2-alpha.20261019.1',
      'v0.0.1',
      'v0.0.1-beta.20261017.1'
    ]
      .map((tag) => `<link rel="alternate" href="https://github.com/o/r/releases/tag/${tag}"/>`)
      .join('\n')
    expect(newestAlpha(atom)).toBe('v0.0.2-alpha.20261019.1')
    expect(newestAlpha('<feed></feed>')).toBeNull()
  })
})

describe('de onde vem cada .yml', () => {
  const from = (stable: string | null, alpha: string | null) =>
    Object.fromEntries(feedSources(stable, alpha).map((source) => [source.name, source.tags]))

  test('alpha mais novo: o alpha.yml tenta o alpha e cai na estável; o latest.yml é da estável', () => {
    const sources = from('v0.0.1', 'v0.0.2-alpha.20261019.1')
    expect(sources['latest.yml']).toEqual(['v0.0.1'])
    expect(sources['alpha.yml']).toEqual(['v0.0.2-alpha.20261019.1', 'v0.0.1'])
    expect(sources['alpha-mac.yml']).toEqual(['v0.0.2-alpha.20261019.1', 'v0.0.1'])
    expect(sources['beta.yml']).toEqual(['v0.0.1'])
  })

  test('depois da promoção o alpha antigo sai do feed', () => {
    expect(from('v0.0.2', 'v0.0.2-alpha.20261019.1')['alpha.yml']).toEqual(['v0.0.2'])
  })

  test('sem estável, só o alpha', () => {
    expect(feedSources(null, 'v0.0.1-alpha.20261017.1').map((source) => source.name)).toEqual([
      'alpha.yml',
      'alpha-mac.yml'
    ])
  })
})

describe('.yml', () => {
  test('lê versão, data e arquivos sem repetir', () => {
    expect(readYml(MAC)).toEqual({
      version: '0.0.1',
      releaseDate: '2026-10-17T17:52:10.000Z',
      files: [
        { name: 'Auri-0.0.1-arm64-mac.zip', size: 123945973 },
        { name: 'auri-0.0.1-arm64.dmg', size: 124067986 }
      ]
    })
  })

  test('url e path apontam para a release do GitHub; o resto fica igual', () => {
    const rewritten = rewriteYml(LATEST, 'v0.0.1')
    const url =
      'https://github.com/GuilhermeBrun/auri/releases/download/v0.0.1/auri-0.0.1-setup.exe'
    expect(rewritten).toContain(`  - url: ${url}\n`)
    expect(rewritten).toContain(`path: ${url}\n`)
    expect(rewritten).toContain('sha512: abc')
    expect(rewritten).toContain("releaseDate: '2026-10-17T17:51:38.214Z'")
    expect(rewriteYml(rewritten, 'v0.0.1')).toBe(rewritten)
  })
})

test('a página recebe a estável com Windows e Mac, e o alpha mais novo', () => {
  const alpha = 'v0.0.2-alpha.20261019.1'
  const releases = releasesFrom(
    [
      { name: 'latest.yml', tag: 'v0.0.1', text: LATEST },
      { name: 'latest-mac.yml', tag: 'v0.0.1', text: MAC },
      { name: 'alpha.yml', tag: alpha, text: ALPHA }
    ],
    'v0.0.1',
    alpha
  )
  expect(releases.stable).toEqual({
    tag: 'v0.0.1',
    publishedAt: '2026-10-17T17:51:38.214Z',
    assets: [
      { name: 'latest.yml', size: undefined },
      { name: 'auri-0.0.1-setup.exe', size: 106361517 },
      { name: 'latest-mac.yml', size: undefined },
      { name: 'Auri-0.0.1-arm64-mac.zip', size: 123945973 },
      { name: 'auri-0.0.1-arm64.dmg', size: 124067986 }
    ]
  })
  expect(releases.alpha?.publishedAt).toBe('2026-10-19T17:51:38.214Z')
  expect(releases.files).toContainEqual({ name: 'auri-0.0.1-arm64.dmg', tag: 'v0.0.1' })
  expect(releases.files).toContainEqual({
    name: `auri-0.0.2-alpha.20261019.1-setup.exe`,
    tag: alpha
  })
})
