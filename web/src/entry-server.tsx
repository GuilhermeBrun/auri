import { renderToString } from 'react-dom/server'
import { App } from './App'
import { downloadInfo, type Releases } from './releases'

/** HTML da página para o `releases.json` publicado (usado por scripts/prerender.mjs). */
export function render(releases: Releases) {
  const info = downloadInfo(releases)
  return { info, html: renderToString(<App info={info} />) }
}
