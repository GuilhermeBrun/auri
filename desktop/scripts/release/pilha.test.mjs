import assert from 'node:assert/strict'
import { test } from 'node:test'
import { symbolicate } from './pilha.mjs'

const map = JSON.stringify({
  version: 3,
  sources: ['../../src/renderer/src/pages/AgendaPage.tsx'],
  names: ['abrirSessao'],
  mappings: 'AAAAA,UASEA'
})

await test('troca as linhas do código minificado pelo arquivo e a linha do código-fonte', () => {
  const read = (file) => (file === 'out/renderer/assets/index-abc.js.map' ? map : null)
  const stack = [
    'at a (app.asar/out/renderer/assets/index-abc.js:1:1)',
    'at b (app.asar\\out\\renderer\\assets\\index-abc.js:1:11)',
    'at c (app.asar/out/main/index.js:7:9)',
    'at process.processTicksAndRejections (node:internal/process/task_queues:105:5)'
  ].join('\n')
  assert.equal(
    symbolicate(stack, read),
    [
      'at abrirSessao (../../src/renderer/src/pages/AgendaPage.tsx:1:1)',
      'at abrirSessao (../../src/renderer/src/pages/AgendaPage.tsx:10:3)',
      'at c (app.asar/out/main/index.js:7:9)',
      'at process.processTicksAndRejections (node:internal/process/task_queues:105:5)'
    ].join('\n')
  )
})
