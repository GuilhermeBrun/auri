import type { Release, Releases } from './releases'

export const REPO = 'https://github.com/GuilhermeBrun/auri'

export const downloadUrl = (tag: string, name: string) =>
  `${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/
const ALPHA = /^v(\d+)\.(\d+)\.(\d+)-(?:alpha|beta)\.(\d{8})\.(\d+)$/

function parts(tag: string) {
  const stable = STABLE.exec(tag)
  if (stable) return [...stable.slice(1, 4).map(Number), Infinity, Infinity]
  const alpha = ALPHA.exec(tag)
  return alpha ? alpha.slice(1, 6).map(Number) : null
}

export function isNewer(a: string, b: string) {
  const [left, right] = [parts(a), parts(b)]
  if (!left || !right) throw new Error(`Tag inválida: ${!left ? a : b}`)
  const index = left.findIndex((part, i) => part !== right[i])
  return index !== -1 && left[index] > right[index]
}

export function newestAlpha(atom: string) {
  const tags = [...atom.matchAll(/\/releases\/tag\/([^"/<]+)"/g)].map((match) =>
    decodeURIComponent(match[1])
  )
  return tags
    .filter((tag) => ALPHA.test(tag))
    .reduce<string | null>((best, tag) => (!best || isNewer(tag, best) ? tag : best), null)
}

export function feedSources(stable: string | null, alpha: string | null) {
  const newAlpha = alpha && (!stable || isNewer(alpha, stable)) ? alpha : null
  const from = (...tags: (string | null)[]) => tags.filter((tag): tag is string => tag !== null)
  return [
    { name: 'latest.yml', tags: from(stable) },
    { name: 'latest-mac.yml', tags: from(stable) },
    { name: 'alpha.yml', tags: from(newAlpha, stable) },
    { name: 'alpha-mac.yml', tags: from(newAlpha, stable) },
    { name: 'beta.yml', tags: from(stable) },
    { name: 'beta-mac.yml', tags: from(stable) }
  ].filter((source) => source.tags.length > 0)
}

const unquote = (value: string) => value.replace(/^(['"])(.*)\1$/, '$2')

export function readYml(text: string) {
  const version = /^version:\s*(.+)$/m.exec(text)?.[1]
  const releaseDate = /^releaseDate:\s*(.+)$/m.exec(text)?.[1]
  const files = new Map<string, number | undefined>()
  let current: string | undefined
  for (const line of text.split('\n')) {
    const url = /^\s*-\s*url:\s*(.+)$/.exec(line)
    if (url) files.set((current = unquote(url[1].trim())), undefined)
    const size = /^\s+size:\s*(\d+)\s*$/.exec(line)
    if (size && current !== undefined) files.set(current, Number(size[1]))
  }
  return {
    version: version && unquote(version.trim()),
    releaseDate: releaseDate && unquote(releaseDate.trim()),
    files: [...files].map(([name, size]) => ({ name, size }))
  }
}

export function rewriteYml(text: string, tag: string) {
  return text.replace(
    /^(\s*(?:-\s*)?(?:url|path):\s*)(.+)$/gm,
    (line, key: string, value: string) => {
      const name = unquote(value.trim())
      return /^https?:\/\//.test(name) ? line : `${key}${downloadUrl(tag, name)}`
    }
  )
}

export function releasesFrom(
  feed: { name: string; tag: string; text: string }[],
  stable: string | null,
  alpha: string | null
): Releases {
  const release = (tag: string | null): Release | null => {
    const ymls = feed.filter((file) => file.tag === tag)
    if (!tag || ymls.length === 0) return null
    const assets = new Map<string, number | undefined>()
    let publishedAt = ''
    for (const yml of ymls) {
      const read = readYml(yml.text)
      publishedAt ||= read.releaseDate ?? ''
      assets.set(yml.name, undefined)
      for (const file of read.files) assets.set(file.name, file.size)
    }
    return { tag, publishedAt, assets: [...assets].map(([name, size]) => ({ name, size })) }
  }
  const releases = { stable: release(stable), alpha: release(alpha) }
  const files = [releases.stable, releases.alpha].flatMap((r) =>
    r ? r.assets.map(({ name }) => ({ name, tag: r.tag })) : []
  )
  return { ...releases, files }
}
