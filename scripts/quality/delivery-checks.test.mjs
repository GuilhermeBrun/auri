import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDelivery } from './delivery-checks.mjs'

await test('entrega exige o pacote testado, versões do runtime e componentes distribuídos', () => {
  const report = {
    success: true,
    sha: 'commit',
    platform: 'darwin',
    version: '1.0.0',
    worktreeDirty: false,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    asarSha256: 'a'.repeat(64),
    testedAsarSha256: 'a'.repeat(64),
    sbomSha256: 'c'.repeat(64),
    native: [{ sha256: 'b'.repeat(64) }]
  }
  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    metadata: {
      component: { version: '1.0.0' },
      properties: [{ name: 'auri:commit', value: 'commit' }]
    },
    components: ['electron', 'chromium', 'node', 'v8', 'better-sqlite3', 'react', 'react-dom'].map(
      (name) => ({
        'bom-ref': name,
        name,
        version: '1.0.0'
      })
    )
  }
  const run = (r = report, b = bom) => validateDelivery(r, b, 'commit', 'darwin', 'c'.repeat(64))
  assert.equal(run().components, 7)
  assert.throws(() => run({ ...report, sbomSha256: 'd'.repeat(64) }), /manifesto/)
  assert.throws(() => run({ ...report, asarSha256: 'c'.repeat(64) }), /realmente testado/)
  assert.throws(() => run({ ...report, sha: 'outro' }), /outro SHA/)
  assert.throws(() => run({ ...report, native: [] }), /binários nativos/)
  assert.throws(
    () =>
      run(report, { ...bom, components: bom.components.filter((value) => value.name !== 'react') }),
    /omitiu/
  )
  assert.throws(
    () =>
      run(report, {
        ...bom,
        components: [...bom.components, { 'bom-ref': 'dev', name: 'vite-plus', version: '1.2.0' }]
      }),
    /desenvolvimento/
  )
  assert.throws(
    () => run(report, { ...bom, components: [...bom.components, bom.components[0]] }),
    /duplicado/
  )
  assert.throws(
    () => run(report, { ...bom, metadata: { ...bom.metadata, properties: [] } }),
    /outro commit/
  )
  assert.throws(() => run({ ...report, installer: { sha256: '' } }), /sem hash/)
})
