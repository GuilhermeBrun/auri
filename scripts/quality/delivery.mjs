import { readFileSync, readdirSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import { listPackage, extractFile } from '@electron/asar'
import { execution, writeJson } from './evidence.mjs'
import { requireCondition } from './checks.mjs'
import { sha256 } from './risk-checks.mjs'
import { validateDelivery } from './delivery-checks.mjs'

const startedAt = Date.now()
const report = { ...execution(startedAt), success: false }
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
try {
  const tested = json('.quality/package/results.json')
  requireCondition(
    tested.success && tested.sha === report.sha && tested.platform === process.platform,
    'Inventário exige pacote aprovado neste commit/plataforma'
  )
  const folder = readdirSync('dist').includes(`mac-${process.arch}`) ? `mac-${process.arch}` : 'mac'
  const asar =
    process.platform === 'win32'
      ? resolve('dist/win-unpacked/resources/app.asar')
      : resolve('dist', folder, 'Auri.app/Contents/Resources/app.asar')
  report.asarSha256 = sha256(readFileSync(asar))
  report.testedAsarSha256 = tested.asarSha256
  requireCondition(report.asarSha256 === tested.asarSha256, 'O pacote mudou depois dos testes')
  const files = listPackage(asar).map((file) => file.replaceAll('\\', '/'))
  // O inventário usa barras POSIX; a API ASAR resolve diretórios com path.sep do host.
  const readAsar = (file) => extractFile(asar, normalize(file))
  const manifest = JSON.parse(readAsar('package.json').toString())
  report.version = manifest.version
  requireCondition(report.version === json('package.json').version, 'Versão empacotada divergente')
  const packages = new Map()
  const addPackage = (value) => {
    if (!value.name || !value.version) return
    const purl = `pkg:npm/${value.name.split('/').map(encodeURIComponent).join('/')}@${encodeURIComponent(value.version)}`
    packages.set(purl, {
      type: 'library',
      'bom-ref': purl,
      name: value.name,
      version: value.version,
      purl
    })
  }
  for (const file of files.filter((file) =>
    /^\/node_modules\/(?:@[^/]+\/)?[^/]+\/(?:node_modules\/(?:@[^/]+\/)?[^/]+\/)*package\.json$/.test(
      file
    )
  ))
    addPackage(JSON.parse(readAsar(file.slice(1)).toString()))
  for (const value of JSON.parse(readAsar('out/renderer/component-inventory.json').toString()))
    addPackage(value)
  const runtime = json('.quality/package/startup.json').main.runtime
  for (const [name, key] of [
    ['electron', 'electron'],
    ['chromium', 'chrome'],
    ['node', 'node'],
    ['v8', 'v8']
  ]) {
    requireCondition(runtime?.[key], `Runtime não medido: ${name}`)
    packages.set(`runtime:${name}`, {
      type: 'framework',
      'bom-ref': `runtime:${name}`,
      name,
      version: runtime[key]
    })
  }
  report.native = files
    .filter((file) => file.endsWith('.node'))
    .map((file) => ({
      file: file.slice(1),
      sha256: sha256(readAsar(file.slice(1)))
    }))
  for (const native of report.native)
    packages.set(native.file, {
      type: 'file',
      'bom-ref': native.file,
      name: native.file,
      hashes: [{ alg: 'SHA-256', content: native.sha256 }]
    })
  const bom = {
    $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: 'application',
        'bom-ref': `auri@${report.version}`,
        name: 'auri',
        version: report.version
      },
      properties: [
        { name: 'auri:commit', value: report.sha },
        { name: 'auri:platform', value: process.platform },
        { name: 'auri:arch', value: process.arch },
        { name: 'auri:asar-sha256', value: report.asarSha256 },
        {
          name: 'auri:scope',
          value:
            'Pacotes npm no ASAR/chunks, versões dos runtimes e binários .node. Bibliotecas internas de Electron/Chromium e do sistema operacional não são enumeradas individualmente.'
        }
      ]
    },
    components: [...packages.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']))
  }
  if (process.argv.includes('--installer')) {
    const installer = json('.quality/installer/results.json')
    requireCondition(
      installer.success && installer.sha === report.sha && installer.platform === process.platform,
      'Instalador sem teste aprovado neste commit/plataforma'
    )
    const digest = sha256(readFileSync(installer.artifact))
    requireCondition(digest === installer.sha256, 'Instalador mudou depois do teste')
    report.installer = { file: installer.artifact.split(/[\\/]/).pop(), sha256: digest }
  }
  report.signing = 'publisher-not-verified'
  report.success = true
  writeJson('.quality/delivery/sbom.cdx.json', bom)
  report.sbomSha256 = sha256(readFileSync('.quality/delivery/sbom.cdx.json'))
  validateDelivery(report, bom, report.sha, process.platform, report.sbomSha256)
  console.log(`Entrega: ${bom.components.length} componentes; ASAR idêntico ao pacote testado.`)
} catch (error) {
  report.success = false
  report.error = error.message
  console.error(error.message)
  process.exitCode = 1
} finally {
  writeJson('.quality/delivery/results.json', { ...report, ...execution(startedAt) })
}
