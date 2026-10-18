// Decide o que cada execução do Release publica, a partir das tags `v*` do repositório.
//
// Alpha: o commit atual de main, como `X.Y.(Z+1)-alpha.AAAAMMDD.N` (acima da última estável no
// semver, para quem está no canal alpha recebê-lo). Pula se main não mudou desde o último alpha.
// Estável: promove o commit do último alpha, que já foi usado, como `X.Y.Z` (a base do alpha ou a
// versão pedida). Um main que só mudou documentação não gera alpha. Funções puras: quem lê o git
// e escreve as saídas é o cli.mjs.

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/
// `beta` era o nome do alpha até a 0.0.1: as tags antigas contam como alpha.
const ALPHA = /^v(\d+)\.(\d+)\.(\d+)-(?:alpha|beta)\.(\d{8})\.(\d+)$/

function parse(tag) {
  const stable = STABLE.exec(tag)
  if (stable) return { tag, parts: [...stable.slice(1, 4).map(Number), Infinity, Infinity] }
  const alpha = ALPHA.exec(tag)
  if (alpha) return { tag, parts: alpha.slice(1, 6).map(Number) }
  return null
}

function compare(a, b) {
  for (let i = 0; i < a.parts.length; i++) {
    if (a.parts[i] !== b.parts[i]) return a.parts[i] < b.parts[i] ? -1 : 1
  }
  return 0
}

const newest = (tags) =>
  tags.reduce((best, tag) => (!best || compare(tag, best) > 0 ? tag : best), null)

/** A estável e o alpha mais recentes entre as tags (`null` quando não há). */
export function latestTags(tagNames) {
  const tags = tagNames.map(parse).filter(Boolean)
  const stable = newest(tags.filter((tag) => tag.parts[3] === Infinity))
  const alpha = newest(tags.filter((tag) => tag.parts[3] !== Infinity))
  return { stable: stable?.tag ?? null, alpha: alpha?.tag ?? null }
}

/** `true` quando a versão `a` é mais nova que `b` (ambas sem o `v`). */
export function isNewer(a, b) {
  const [left, right] = [parse(`v${a}`), parse(`v${b}`)]
  if (!left || !right) throw new Error(`Versão inválida: ${!left ? a : b}`)
  return compare(left, right) > 0
}

const day = (date) => date.toISOString().slice(0, 10).replaceAll('-', '')

/**
 * Próximo alpha. `tagNames`: todas as tags; `firstVersion`: a versão do package.json, a primeira
 * estável a sair. Enquanto não existe nenhuma estável, os alphas são dela (`0.0.1-alpha...`);
 * depois, da seguinte à última estável.
 */
export function nextAlpha({ tagNames, firstVersion, date }) {
  const { stable } = latestTags(tagNames)
  const [major, minor, patch] = stable ? parse(stable).parts : parse(`v${firstVersion}`).parts
  const base = `${major}.${minor}.${stable ? patch + 1 : patch}`
  const prefix = `v${base}-alpha.${day(date)}.`
  const today = tagNames
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => Number(tag.slice(prefix.length)))
  return `${base}-alpha.${day(date)}.${Math.max(0, ...today) + 1}`
}

// Chega ao Auri o que está em desktop/ (menos documentação) e os workflows que o montam. O site
// (web/) e a documentação não geram alpha.
const APP = [/^desktop\//, /^\.github\//]
const DOCS = [/^desktop\/docs\//, /\.md$/i]

/** `true` quando nenhum dos arquivos mudados chega ao Auri. */
export function outsideApp(changedFiles) {
  return changedFiles.every(
    (file) =>
      !APP.some((pattern) => pattern.test(file)) || DOCS.some((pattern) => pattern.test(file))
  )
}

/** Versão estável que promove `alphaTag`: a pedida ou a base do alpha. */
export function stableFromAlpha({ tagNames, alphaTag, requested }) {
  if (!alphaTag) throw new Error('Nenhum alpha publicado para promover.')
  const version = requested?.trim().replace(/^v/, '') || ALPHA.exec(alphaTag).slice(1, 4).join('.')
  if (!STABLE.test(`v${version}`)) throw new Error(`Versão estável inválida: ${version}`)
  if (tagNames.includes(`v${version}`)) throw new Error(`A versão ${version} já existe.`)
  const { stable } = latestTags(tagNames)
  if (stable && !isNewer(version, stable.slice(1))) {
    throw new Error(`A versão ${version} não é mais nova que a estável ${stable.slice(1)}.`)
  }
  return version
}

/**
 * Arquivos do site de atualização (GitHub Pages). Ficam os da última estável e, se houver um alpha
 * mais novo, os instaladores dele e o `alpha.yml` (e `alpha-mac.yml`, se o alpha tiver Mac), que
 * substituem os da estável. Alpha só de Windows deixa o Mac do canal alpha na estável.
 */
export function siteFiles({ stable, alpha }) {
  const files = new Map()
  for (const name of stable?.assets ?? []) files.set(name, stable.tag)
  if (alpha && (!stable || isNewer(alpha.tag.slice(1), stable.tag.slice(1)))) {
    for (const name of alpha.assets) {
      if (/\.(exe|zip|blockmap)$/.test(name) || /^alpha(-mac)?\.yml$/.test(name)) {
        files.set(name, alpha.tag)
      }
    }
  }
  if (!files.has('latest.yml') && !files.has('alpha.yml')) {
    throw new Error('Nenhum latest.yml ou alpha.yml para publicar.')
  }
  return [...files]
    .map(([name, tag]) => ({ name, tag }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
