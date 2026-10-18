// Publica no Vercel Blob o que o Auri instalado usa para se atualizar: os instaladores, os
// latest/alpha.yml e o releases.json (da página de download). Usado pelo job Atualização do
// release.yml, depois de `cli.mjs site <pasta>` baixar os arquivos das releases:
//
//   BLOB_READ_WRITE_TOKEN=… node web/scripts/publicar-atualizacoes.mjs <pasta>
//
// Os instaladores têm a versão no nome e só sobem uma vez; os .yml e o releases.json são regravados
// a cada release. O que não está mais na pasta (versões antigas) é apagado: o Blob do plano Hobby
// guarda até 1 GB.
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { del, list, put } from '@vercel/blob'

const MUTABLE = /\.(ya?ml|json)$/
const directory = process.argv[2] ?? 'site'

const names = (await readdir(directory)).filter((name) => !name.startsWith('.'))
if (!names.some((name) => /^(latest|alpha)\.yml$/.test(name))) {
  throw new Error(`${directory} sem latest.yml nem alpha.yml.`)
}

const published = new Map()
let cursor
do {
  const page = await list({ cursor, limit: 1000 })
  for (const blob of page.blobs) published.set(blob.pathname, blob)
  cursor = page.cursor
} while (cursor)

for (const name of names) {
  const file = join(directory, name)
  const { size } = await stat(file)
  const mutable = MUTABLE.test(name)
  if (!mutable && published.get(name)?.size === size) {
    console.log(`= ${name}`)
    continue
  }
  await put(name, createReadStream(file), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: size > 20 * 1024 ** 2,
    // os .yml mudam a cada release; um instalador nunca muda depois de publicado
    cacheControlMaxAge: mutable ? 60 : 60 * 60 * 24 * 365
  })
  console.log(`↑ ${name}`)
}

const stale = [...published.values()].filter((blob) => !names.includes(blob.pathname))
if (stale.length > 0) {
  await del(stale.map((blob) => blob.url))
  console.log(stale.map((blob) => `✕ ${blob.pathname}`).join('\n'))
}
