import { execFileSync } from 'node:child_process'

const lista = JSON.parse(
  execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' })
)
const versao = (texto) => texto.split(/[.-]/).map(Number)
const ate = ([a, b = 0], [c, d = 0]) => a < c || (a === c && b <= d)
const doIOS = (runtime) => versao(runtime.split('.iOS-')[1])
const sdk = versao(
  execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version'], {
    encoding: 'utf8'
  }).trim()
)
const iphones = Object.keys(lista.devices)
  .filter((runtime) => runtime.includes('.iOS-') && ate(doIOS(runtime), sdk))
  .sort((a, b) => (ate(doIOS(a), doIOS(b)) ? -1 : 1))
  .flatMap((runtime) => lista.devices[runtime])
  .filter(({ name }) => name.startsWith('iPhone'))
const ligado = ({ state }) => state === 'Booted'
const comuns = iphones.filter(({ name }) => /^iPhone \d+ Pro$/.test(name))
const escolhido = comuns.find(ligado) ?? comuns.at(-1) ?? iphones.find(ligado) ?? iphones.at(-1)
if (!escolhido) {
  console.error('Nenhum simulador de iPhone instalado. Rode `xcodebuild -downloadPlatform iOS`.')
  process.exit(1)
}
if (escolhido.state !== 'Booted') execFileSync('xcrun', ['simctl', 'boot', escolhido.udid])
console.log(`platform=iOS Simulator,id=${escolhido.udid}`)
