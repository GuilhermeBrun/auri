// Decide o que cada execução do Release publica, a partir das tags `v*` do repositório.
//
// Beta: o commit atual de main, como `X.Y.(Z+1)-beta.AAAAMMDD.N` (acima da última estável no
// semver, para quem está no canal beta recebê-lo). Pula se main não mudou desde o último beta.
// Estável: promove o commit do último beta, que já foi usado, como `X.Y.Z` (a base do beta ou a
// versão pedida). Funções puras: quem lê o git e escreve as saídas é o cli.mjs.

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/
const BETA = /^v(\d+)\.(\d+)\.(\d+)-beta\.(\d{8})\.(\d+)$/

function parse(tag) {
  const stable = STABLE.exec(tag)
  if (stable) return { tag, parts: [...stable.slice(1, 4).map(Number), Infinity, Infinity] }
  const beta = BETA.exec(tag)
  if (beta) return { tag, parts: beta.slice(1, 6).map(Number) }
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

/** A estável e o beta mais recentes entre as tags (`null` quando não há). */
export function latestTags(tagNames) {
  const tags = tagNames.map(parse).filter(Boolean)
  const stable = newest(tags.filter((tag) => tag.parts[3] === Infinity))
  const beta = newest(tags.filter((tag) => tag.parts[3] !== Infinity))
  return { stable: stable?.tag ?? null, beta: beta?.tag ?? null }
}

/** `true` quando a versão `a` é mais nova que `b` (ambas sem o `v`). */
export function isNewer(a, b) {
  const [left, right] = [parse(`v${a}`), parse(`v${b}`)]
  if (!left || !right) throw new Error(`Versão inválida: ${!left ? a : b}`)
  return compare(left, right) > 0
}

const day = (date) => date.toISOString().slice(0, 10).replaceAll('-', '')

/**
 * Próximo beta. `tagNames`: todas as tags; `stableFallback`: a versão do package.json, usada
 * só enquanto não existe nenhuma estável.
 */
export function nextBeta({ tagNames, stableFallback, date }) {
  const { stable } = latestTags(tagNames)
  const [major, minor, patch] = stable ? parse(stable).parts : parse(`v${stableFallback}`).parts
  const base = `${major}.${minor}.${patch + 1}`
  const prefix = `v${base}-beta.${day(date)}.`
  const today = tagNames
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => Number(tag.slice(prefix.length)))
  return `${base}-beta.${day(date)}.${Math.max(0, ...today) + 1}`
}

/** Versão estável que promove `betaTag`: a pedida ou a base do beta. */
export function stableFromBeta({ tagNames, betaTag, requested }) {
  if (!betaTag) throw new Error('Nenhum beta publicado para promover.')
  const version = requested?.trim().replace(/^v/, '') || BETA.exec(betaTag).slice(1, 4).join('.')
  if (!STABLE.test(`v${version}`)) throw new Error(`Versão estável inválida: ${version}`)
  if (tagNames.includes(`v${version}`)) throw new Error(`A versão ${version} já existe.`)
  const { stable } = latestTags(tagNames)
  if (stable && !isNewer(version, stable.slice(1))) {
    throw new Error(`A versão ${version} não é mais nova que a estável ${stable.slice(1)}.`)
  }
  return version
}

/**
 * Arquivos do site de atualização (GitHub Pages). Ficam os da última estável e, se houver um beta
 * mais novo, os instaladores dele e o `beta.yml` (e `beta-mac.yml`, se o beta tiver Mac), que
 * substituem os da estável. Beta só de Windows deixa o Mac do canal beta na estável.
 */
export function siteFiles({ stable, beta }) {
  const files = new Map()
  for (const name of stable?.assets ?? []) files.set(name, stable.tag)
  if (beta && (!stable || isNewer(beta.tag.slice(1), stable.tag.slice(1)))) {
    for (const name of beta.assets) {
      if (/\.(exe|zip|blockmap)$/.test(name) || /^beta(-mac)?\.yml$/.test(name)) {
        files.set(name, beta.tag)
      }
    }
  }
  if (!files.has('latest.yml') && !files.has('beta.yml')) {
    throw new Error('Nenhum latest.yml ou beta.yml para publicar.')
  }
  return [...files]
    .map(([name, tag]) => ({ name, tag }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
