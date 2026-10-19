import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { downloadInfo, type DownloadInfo } from './releases'
import './style.css'

const embedded = document.getElementById('download-info')?.textContent
const info: DownloadInfo = embedded
  ? JSON.parse(embedded)
  : downloadInfo((await import('../releases.exemplo.json')).default)

const root = document.getElementById('root')!
const app = <App info={info} />
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
