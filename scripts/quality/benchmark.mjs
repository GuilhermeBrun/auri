import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const work = mkdtempSync(join(tmpdir(), 'auri-benchmark-'))
try {
  for (const file of ['masks', 'search']) {
    const source = readFileSync(`src/shared/${file}.ts`, 'utf8')
    // O TypeScript 7 não expõe API JavaScript; o Node só apaga os tipos, sem compilar.
    writeFileSync(
      join(work, `${file}.mjs`),
      stripTypeScriptTypes(source).replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
    )
  }
  const { createPatientSearch } = await import(pathToFileURL(join(work, 'search.mjs')).href)
  const policy = JSON.parse(readFileSync('docs/qualidade/desempenho.json', 'utf8'))
  const patients = Array.from({ length: policy.patients }, (_, id) => ({
    id,
    nome: `Paciente João Fictício ${id}`,
    mae_nome: `Mãe Fictícia ${id}`,
    cpf: String(id).padStart(11, '0'),
    mae_cpf: ''
  }))
  const search = createPatientSearch(patients)
  const queries = ['joao', 'fictício', 'NOME INEXISTENTE', '00000000000']
  for (let i = 0; i < 20; i++) search(queries[i % queries.length])
  const samples = []
  for (let i = 0; i < policy.samples; i++) {
    const index = i % queries.length
    const started = performance.now()
    const result = search(queries[index])
    samples.push(performance.now() - started)
    if (index === 0 || index === 1) assert.equal(result.length, policy.patients)
    else if (index === 2) assert.equal(result.length, 0)
    else
      assert.deepEqual(
        result.map((patient) => patient.id),
        [0]
      )
  }
  samples.sort((a, b) => a - b)
  writeFileSync(
    resolve(process.argv[2]),
    JSON.stringify({
      patients: patients.length,
      samples: samples.length,
      resultsVerified: true,
      p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
      medianMs: samples[Math.floor(samples.length / 2)]
    })
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}
