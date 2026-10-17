import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isNewer, latestTags, nextBeta, onlyDocs, siteFiles, stableFromBeta } from './versions.mjs'

const date = new Date('2026-10-16T06:00:00Z')

await test('separa a estável e o beta mais recentes, ignorando outras tags', () => {
  const tags = ['v1.0.0', 'v1.1.0', 'v1.1.1-beta.20261015.1', 'v1.1.1-beta.20261016.2', 'teste']
  assert.deepEqual(latestTags(tags), { stable: 'v1.1.0', beta: 'v1.1.1-beta.20261016.2' })
  assert.deepEqual(latestTags([]), { stable: null, beta: null })
})

await test('o beta fica acima da estável e numera os do mesmo dia', () => {
  assert.equal(nextBeta({ tagNames: ['v1.1.0'], date }), '1.1.1-beta.20261016.1')
  assert.equal(
    nextBeta({ tagNames: ['v1.1.0', 'v1.1.1-beta.20261016.1'], date }),
    '1.1.1-beta.20261016.2'
  )
  assert.equal(nextBeta({ tagNames: [], stableFallback: '1.1.0', date }), '1.1.1-beta.20261016.1')
  assert.ok(isNewer('1.1.1-beta.20261016.1', '1.1.0'))
  assert.ok(isNewer('1.1.1', '1.1.1-beta.20261016.9'))
  assert.ok(isNewer('1.1.1-beta.20261017.1', '1.1.1-beta.20261016.9'))
})

await test('só documentação não gera beta', () => {
  assert.ok(onlyDocs(['docs/ci.md', 'README.md', 'docs/qualidade/visual/win32/agenda.png']))
  assert.ok(!onlyDocs(['docs/ci.md', 'src/main/index.ts']))
  assert.ok(!onlyDocs(['electron-builder.yml']))
})

await test('a estável promove o último beta', () => {
  const tagNames = ['v1.1.0', 'v1.1.1-beta.20261016.1']
  const betaTag = 'v1.1.1-beta.20261016.1'
  assert.equal(stableFromBeta({ tagNames, betaTag }), '1.1.1')
  assert.equal(stableFromBeta({ tagNames, betaTag, requested: 'v1.2.0' }), '1.2.0')
  assert.throws(() => stableFromBeta({ tagNames, betaTag: null }), /Nenhum beta/)
  assert.throws(() => stableFromBeta({ tagNames, betaTag, requested: '1.1.0' }), /já existe/)
  assert.throws(() => stableFromBeta({ tagNames, betaTag, requested: '1.0.9' }), /não é mais nova/)
  assert.throws(() => stableFromBeta({ tagNames, betaTag, requested: '1.2' }), /inválida/)
})

const stable = {
  tag: 'v1.1.0',
  assets: [
    'Auri-1.1.0.exe',
    'Auri-1.1.0.exe.blockmap',
    'Auri-1.1.0.dmg',
    'Auri-1.1.0-arm64-mac.zip',
    'latest.yml',
    'beta.yml',
    'latest-mac.yml',
    'beta-mac.yml'
  ]
}
const beta = {
  tag: 'v1.1.1-beta.20261016.1',
  assets: [
    'Auri-1.1.1-beta.20261016.1.exe',
    'Auri-1.1.1-beta.20261016.1.exe.blockmap',
    'beta.yml',
    'alpha.yml'
  ]
}

await test('o site leva a estável e o beta mais novo, com o beta.yml do beta', () => {
  const files = siteFiles({ stable, beta })
  const from = Object.fromEntries(files.map((file) => [file.name, file.tag]))
  assert.equal(from['latest.yml'], 'v1.1.0')
  assert.equal(from['beta.yml'], beta.tag)
  assert.equal(from['Auri-1.1.1-beta.20261016.1.exe'], beta.tag)
  assert.equal(from['Auri-1.1.0.dmg'], 'v1.1.0')
  assert.equal(from['alpha.yml'], undefined)
  // beta só de Windows: o Mac do canal beta segue na estável
  assert.equal(from['beta-mac.yml'], 'v1.1.0')
  assert.equal(from['Auri-1.1.0-arm64-mac.zip'], 'v1.1.0')
})

await test('um beta com Mac leva o zip e o beta-mac.yml dele', () => {
  const withMac = {
    ...beta,
    assets: [...beta.assets, 'Auri-1.1.1-beta.20261016.1-arm64-mac.zip', 'beta-mac.yml']
  }
  const from = Object.fromEntries(
    siteFiles({ stable, beta: withMac }).map((file) => [file.name, file.tag])
  )
  assert.equal(from['beta-mac.yml'], beta.tag)
  assert.equal(from['Auri-1.1.1-beta.20261016.1-arm64-mac.zip'], beta.tag)
  assert.equal(from['latest-mac.yml'], 'v1.1.0')
})

await test('depois da promoção o beta antigo sai do site', () => {
  const promoted = { ...stable, tag: 'v1.1.1' }
  const files = siteFiles({ stable: promoted, beta })
  assert.ok(files.every((file) => file.tag === 'v1.1.1'))
  assert.throws(() => siteFiles({ stable: null, beta: null }), /Nenhum latest.yml/)
})
