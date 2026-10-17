import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isNewer,
  latestTags,
  nextAlpha,
  onlyDocs,
  siteFiles,
  stableFromAlpha
} from './versions.mjs'

const date = new Date('2026-10-16T06:00:00Z')

await test('separa a estável e o alpha mais recentes, ignorando outras tags', () => {
  const tags = ['v1.0.0', 'v1.1.0', 'v1.1.1-alpha.20261015.1', 'v1.1.1-alpha.20261016.2', 'teste']
  assert.deepEqual(latestTags(tags), { stable: 'v1.1.0', alpha: 'v1.1.1-alpha.20261016.2' })
  assert.deepEqual(latestTags([]), { stable: null, alpha: null })
})

await test('o alpha fica acima da estável e numera os do mesmo dia', () => {
  assert.equal(nextAlpha({ tagNames: ['v1.1.0'], date }), '1.1.1-alpha.20261016.1')
  assert.equal(
    nextAlpha({ tagNames: ['v1.1.0', 'v1.1.1-alpha.20261016.1'], date }),
    '1.1.1-alpha.20261016.2'
  )
  // Sem nenhuma estável, os alphas são da primeira versão, que a estável depois promove.
  assert.equal(nextAlpha({ tagNames: [], firstVersion: '0.0.1', date }), '0.0.1-alpha.20261016.1')
  // as tags do tempo em que o canal se chamava beta contam como alpha
  assert.deepEqual(latestTags(['v0.0.1-beta.20261017.1']), {
    stable: null,
    alpha: 'v0.0.1-beta.20261017.1'
  })
  assert.equal(
    stableFromAlpha({ tagNames: ['v0.0.1-beta.20261017.1'], alphaTag: 'v0.0.1-beta.20261017.1' }),
    '0.0.1'
  )
  assert.equal(
    stableFromAlpha({ tagNames: ['v0.0.1-alpha.20261016.1'], alphaTag: 'v0.0.1-alpha.20261016.1' }),
    '0.0.1'
  )
  assert.ok(isNewer('1.1.1-alpha.20261016.1', '1.1.0'))
  assert.ok(isNewer('1.1.1', '1.1.1-alpha.20261016.9'))
  assert.ok(isNewer('1.1.1-alpha.20261017.1', '1.1.1-alpha.20261016.9'))
})

await test('só documentação não gera alpha', () => {
  assert.ok(onlyDocs(['docs/ci.md', 'README.md', 'docs/qualidade/visual/win32/agenda.png']))
  assert.ok(!onlyDocs(['docs/ci.md', 'src/main/index.ts']))
  assert.ok(!onlyDocs(['electron-builder.yml']))
})

await test('a estável promove o último alpha', () => {
  const tagNames = ['v1.1.0', 'v1.1.1-alpha.20261016.1']
  const alphaTag = 'v1.1.1-alpha.20261016.1'
  assert.equal(stableFromAlpha({ tagNames, alphaTag }), '1.1.1')
  assert.equal(stableFromAlpha({ tagNames, alphaTag, requested: 'v1.2.0' }), '1.2.0')
  assert.throws(() => stableFromAlpha({ tagNames, alphaTag: null }), /Nenhum alpha/)
  assert.throws(() => stableFromAlpha({ tagNames, alphaTag, requested: '1.1.0' }), /já existe/)
  assert.throws(
    () => stableFromAlpha({ tagNames, alphaTag, requested: '1.0.9' }),
    /não é mais nova/
  )
  assert.throws(() => stableFromAlpha({ tagNames, alphaTag, requested: '1.2' }), /inválida/)
})

const stable = {
  tag: 'v1.1.0',
  assets: [
    'Auri-1.1.0.exe',
    'Auri-1.1.0.exe.blockmap',
    'Auri-1.1.0.dmg',
    'Auri-1.1.0-arm64-mac.zip',
    'latest.yml',
    'alpha.yml',
    'latest-mac.yml',
    'alpha-mac.yml'
  ]
}
const alpha = {
  tag: 'v1.1.1-alpha.20261016.1',
  assets: [
    'Auri-1.1.1-alpha.20261016.1.exe',
    'Auri-1.1.1-alpha.20261016.1.exe.blockmap',
    'alpha.yml'
  ]
}

await test('o site leva a estável e o alpha mais novo, com o alpha.yml do alpha', () => {
  const files = siteFiles({ stable, alpha })
  const from = Object.fromEntries(files.map((file) => [file.name, file.tag]))
  assert.equal(from['latest.yml'], 'v1.1.0')
  assert.equal(from['alpha.yml'], alpha.tag)
  assert.equal(from['Auri-1.1.1-alpha.20261016.1.exe'], alpha.tag)
  assert.equal(from['Auri-1.1.0.dmg'], 'v1.1.0')
  // alpha só de Windows: o Mac do canal alpha segue na estável
  assert.equal(from['alpha-mac.yml'], 'v1.1.0')
  assert.equal(from['Auri-1.1.0-arm64-mac.zip'], 'v1.1.0')
})

await test('um alpha com Mac leva o zip e o alpha-mac.yml dele', () => {
  const withMac = {
    ...alpha,
    assets: [...alpha.assets, 'Auri-1.1.1-alpha.20261016.1-arm64-mac.zip', 'alpha-mac.yml']
  }
  const from = Object.fromEntries(
    siteFiles({ stable, alpha: withMac }).map((file) => [file.name, file.tag])
  )
  assert.equal(from['alpha-mac.yml'], alpha.tag)
  assert.equal(from['Auri-1.1.1-alpha.20261016.1-arm64-mac.zip'], alpha.tag)
  assert.equal(from['latest-mac.yml'], 'v1.1.0')
})

await test('depois da promoção o alpha antigo sai do site', () => {
  const promoted = { ...stable, tag: 'v1.1.1' }
  const files = siteFiles({ stable: promoted, alpha })
  assert.ok(files.every((file) => file.tag === 'v1.1.1'))
  assert.throws(() => siteFiles({ stable: null, alpha: null }), /Nenhum latest.yml/)
})
