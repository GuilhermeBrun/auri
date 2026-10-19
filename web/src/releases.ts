import { downloadUrl } from './feed'

export type Release = {
  tag: string
  publishedAt: string
  assets: { name: string; size?: number }[]
}

export type Releases = {
  stable: Release | null
  alpha: Release | null
  files: { name: string; tag: string }[]
}

export type Os = 'win' | 'mac'

export const SYSTEMS: Record<Os, { label: string; pattern: RegExp; requires: string }> = {
  win: { label: 'Windows', pattern: /-setup\.exe$/, requires: 'Windows 10 ou 11' },
  mac: { label: 'Mac', pattern: /\.dmg$/, requires: 'Apple Silicon (M1 ou mais novo)' }
}

export type Installer = { os: Os; name: string; url: string; size?: number }

export const megabytes = (bytes: number) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(bytes / 1024 ** 2)} MB`

export const longDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(iso))

function installer(release: Release, files: Releases['files'], os: Os): Installer | null {
  const file = files.find((file) => file.tag === release.tag && SYSTEMS[os].pattern.test(file.name))
  if (!file) return null
  const asset = release.assets.find((asset) => asset.name === file.name)
  return { os, name: file.name, url: downloadUrl(release.tag, file.name), size: asset?.size }
}

export function downloadInfo({ stable, alpha, files }: Releases) {
  const main = stable ?? alpha
  if (!main) throw new Error('releases.json sem estável nem alpha.')
  const win = installer(main, files, 'win')
  const mac = installer(main, files, 'mac')
  return {
    version: main.tag.slice(1),
    publishedAt: main.publishedAt,
    isAlpha: main === alpha,
    options: [win, mac].filter((option): option is Installer => option !== null),
    missing: !mac
      ? 'Ainda não há versão para Mac.'
      : !win
        ? 'Ainda não há versão para Windows.'
        : ''
  }
}

export type DownloadInfo = ReturnType<typeof downloadInfo>
