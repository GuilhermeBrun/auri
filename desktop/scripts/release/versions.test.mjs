import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isNewer, latestTags, nextAlpha, outsideApp, stableFromAlpha } from './versions.mjs'

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
  assert.equal(nextAlpha({ tagNames: [], firstVersion: '0.0.1', date }), '0.0.1-alpha.20261016.1')
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

await test('só documentação ou o site não geram alpha', () => {
  assert.ok(
    outsideApp(['docs/ci.md', 'README.md', 'desktop/docs/qualidade/visual/win32/agenda.png'])
  )
  assert.ok(outsideApp(['web/src/main.tsx', 'web/package.json']))
  assert.ok(!outsideApp(['docs/ci.md', 'desktop/src/main/index.ts']))
  assert.ok(!outsideApp(['desktop/electron-builder.yml']))
  assert.ok(!outsideApp(['.github/workflows/release.yml']))
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
