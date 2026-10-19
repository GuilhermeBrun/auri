const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/
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

export function latestTags(tagNames) {
  const tags = tagNames.map(parse).filter(Boolean)
  const stable = newest(tags.filter((tag) => tag.parts[3] === Infinity))
  const alpha = newest(tags.filter((tag) => tag.parts[3] !== Infinity))
  return { stable: stable?.tag ?? null, alpha: alpha?.tag ?? null }
}

export function isNewer(a, b) {
  const [left, right] = [parse(`v${a}`), parse(`v${b}`)]
  if (!left || !right) throw new Error(`Versão inválida: ${!left ? a : b}`)
  return compare(left, right) > 0
}

const day = (date) => date.toISOString().slice(0, 10).replaceAll('-', '')

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

const APP = [/^desktop\//, /^\.github\//]
const DOCS = [/^desktop\/docs\//, /\.md$/i]

export function outsideApp(changedFiles) {
  return changedFiles.every(
    (file) =>
      !APP.some((pattern) => pattern.test(file)) || DOCS.some((pattern) => pattern.test(file))
  )
}

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
