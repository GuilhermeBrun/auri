import { execFileSync } from 'node:child_process'

const lista = JSON.parse(
  execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' })
)
const iphones = Object.entries(lista.devices)
  .filter(([runtime]) => runtime.includes('iOS'))
  .flatMap(([, aparelhos]) => aparelhos)
  .filter(({ name }) => name.startsWith('iPhone'))
const escolhido = iphones.find(({ state }) => state === 'Booted') ?? iphones.at(-1)
if (!escolhido) {
  console.error('Nenhum simulador de iPhone instalado. Rode `xcodebuild -downloadPlatform iOS`.')
  process.exit(1)
}
if (escolhido.state !== 'Booted') execFileSync('xcrun', ['simctl', 'boot', escolhido.udid])
console.log(`platform=iOS Simulator,id=${escolhido.udid}`)
