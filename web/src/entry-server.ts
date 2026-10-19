import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App'
import { downloadInfo, type Releases } from './releases'

export { REPO, downloadUrl, feedSources, newestAlpha, releasesFrom, rewriteYml } from './feed'

export function render(releases: Releases) {
  const info = downloadInfo(releases)
  return { info, html: renderToString(createElement(App, { info })) }
}
