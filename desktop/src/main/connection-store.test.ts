import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { createConnectionStore } from './connection-store'

let folder: string
let file: string

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'auri-conexao-'))
  file = join(folder, 'conexao.json')
})

afterEach(() => rmSync(folder, { recursive: true, force: true }))

describe('conexao.json', () => {
  it('os aparelhos pareados antes do celular continuam como computador', () => {
    writeFileSync(
      file,
      JSON.stringify({
        role: 'server',
        devices: [{ publicKey: 'ab12', name: 'Consultório', lastSeen: null }]
      })
    )
    expect(createConnectionStore(file).get().devices).toEqual([
      { publicKey: 'ab12', name: 'Consultório', tipo: 'computador', nivel: null, lastSeen: null }
    ])
  })

  it('grava o tipo e o nível e não deixa arquivo temporário', () => {
    const store = createConnectionStore(file)
    store.update({
      devices: [
        { publicKey: 'cd34', name: 'iPhone', tipo: 'celular', nivel: 'recepcao', lastSeen: null }
      ]
    })
    expect(JSON.parse(readFileSync(file, 'utf8')).devices).toEqual([
      { publicKey: 'cd34', name: 'iPhone', tipo: 'celular', nivel: 'recepcao', lastSeen: null }
    ])
    expect(readdirSync(folder)).toEqual(['conexao.json'])
    expect(createConnectionStore(file).get().devices[0]).toMatchObject({ nivel: 'recepcao' })
  })
})
