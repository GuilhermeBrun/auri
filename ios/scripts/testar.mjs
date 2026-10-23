import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import createTestnet from 'hyperdht/testnet.js'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const testnet = await createTestnet(3)
const bootstrap = testnet.bootstrap.map(({ host, port }) => `${host}:${port}`).join(',')
const servidores = []

function subir(porta, env) {
  return new Promise((resolve, reject) => {
    const servidor = spawn('node', ['scripts/servidor.mjs', String(porta)], {
      cwd: raiz,
      detached: true,
      env: { ...process.env, AURI_BOOTSTRAP: bootstrap, ...env }
    })
    servidores.push(servidor)
    let saida = ''
    servidor.stdout.on('data', (dados) => {
      saida += dados
      const convite = saida.match(/^convite (.+)$/m)
      if (convite) resolve(convite[1])
    })
    servidor.stderr.on('data', (dados) => process.stderr.write(dados))
    servidor.on('exit', (codigo) => reject(new Error(`O computador de teste saiu (${codigo}).`)))
  })
}

let status = 1
try {
  const [recepcao, outro, antigo, novo] = await Promise.all([
    subir(47491, { AURI_AVISO: '1' }),
    subir(47492, { AURI_NOME: 'Outro computador', AURI_NIVEL: 'recepcao' }),
    subir(47493, { AURI_VAZIO: '1', AURI_NOME: 'Computador antigo', AURI_TIPO: 'computador' }),
    subir(47494, { AURI_VAZIO: '1', AURI_NOME: 'Computador novo', AURI_API: '1000' })
  ])
  const gravar = process.argv.includes('--gravar')
  status = await new Promise((resolve) => {
    const argumentos = [
      'build/nucleo.test.cjs',
      recepcao,
      outro,
      bootstrap,
      gravar ? 'gravar' : 'conferir',
      antigo,
      novo
    ]
    const bare = spawn(`${raiz}node_modules/.bin/bare`, argumentos, {
      cwd: raiz,
      stdio: ['inherit', 'pipe', 'inherit']
    })
    let saida = ''
    bare.stdout.on('data', (dados) => {
      saida += dados
      process.stdout.write(dados)
    })
    bare.on('exit', (codigo) => {
      const contrato = saida.match(/^CONTRATO (\d+) (.+)$/m)
      if (gravar && contrato) {
        const arquivo = `Tests/Contrato/contrato-v${contrato[1]}.json`
        writeFileSync(`${raiz}${arquivo}`, JSON.stringify(JSON.parse(contrato[2]), null, 2) + '\n')
        console.log(`${arquivo} gravado.`)
      }
      resolve(codigo ?? 1)
    })
  })
} finally {
  for (const servidor of servidores) {
    try {
      process.kill(-servidor.pid, 'SIGTERM')
    } catch {}
  }
  await testnet.destroy()
}
process.exit(status)
