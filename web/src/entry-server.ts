// Entrada do build de servidor (`vp build --ssr`), usada por scripts/prerender.mjs: o HTML da
// página e as funções do feed de atualização. Sem JSX, para o arquivo poder exportar funções.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App'
import { downloadInfo, type Releases } from './releases'

export { REPO, downloadUrl, feedSources, newestAlpha, releasesFrom, rewriteYml } from './feed'

/** HTML da página para as releases publicadas. */
export function render(releases: Releases) {
  const info = downloadInfo(releases)
  return { info, html: renderToString(createElement(App, { info })) }
}
