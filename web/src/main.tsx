import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { downloadInfo, type DownloadInfo } from './releases'
import './style.css'

// Em produção a página chega pré-renderizada (scripts/prerender.mjs), com os dados da versão num
// <script type="application/json">. No `vp dev` ela é montada aqui, com as releases de exemplo.
const embedded = document.getElementById('download-info')?.textContent
const info: DownloadInfo = embedded
  ? JSON.parse(embedded)
  : downloadInfo((await import('../releases.exemplo.json')).default)

const root = document.getElementById('root')!
const app = <App info={info} />
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
