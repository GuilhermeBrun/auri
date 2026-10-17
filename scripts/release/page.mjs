// Página de download do site de atualização (GitHub Pages). Estilo, script, fonte e ícone ficam em
// site-assets/, copiados para o site junto com os arquivos das releases.

import { windowHtml } from './site-assets/agenda.mjs'

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  )

const megabytes = (bytes) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(bytes / 1024 ** 2)} MB`

const date = (iso) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(iso))

/** Ícone Lucide (traço 1.75, como no app). */
const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const ICONS = {
  download: icon(
    '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'
  ),
  calendar: icon(
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'
  ),
  users: icon(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  ),
  clipboard: icon(
    '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'
  ),
  lock: icon(
    '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  ),
  network: icon(
    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>'
  ),
  settings: icon(
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'
  ),
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
  arrowUp: icon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  monitor: icon(
    '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'
  ),
  sun: icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
  ),
  moon: icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  pointer: icon(
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>'
  ),
  refresh: icon(
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
  )
}

const SYMBOL_PATH =
  'M10 51C3 52 0 46 1 37C5 16 29 0 52 0C84 0 105 19 106 47L106 66C106 76 109 80 113 84C123 96 116 110 102 110C90 110 82 103 74 92L63 77C56 67 49 67 41 73C31 80 27 89 31 96C35 103 44 106 48 109C34 114 15 111 7 101C-1 92-2 77 5 66C13 55 27 49 39 49C58 49 68 58 78 70C82 75 85 80 88 77C90 75 89 70 89 64L88 53C87 40 82 32 73 30C61 25 52 31 40 39L20 49C16 51 12 52 10 51Z'

/** Assinatura "auri" em vetor (resources/brand/auri-v1/auri-grafite.svg), na cor do texto. */
const WORDMARK = `<svg class="wordmark" viewBox="0 0 268 118" fill="currentColor" role="img" aria-label="Auri"><g transform="translate(10 33) scale(0.64)"><path d="${SYMBOL_PATH}"/></g><g transform="translate(-118 2)"><path d="M218 38H231C236 38 239 41 239 46V74C239 82 243 87 251 87C260 87 264 81 264 74V46C264 41 267 38 272 38H284V75C284 94 271 103 251 103C231 103 218 94 218 75V38Z"/><path d="M296 38H314V46C320 39 328 36 340 37V55C324 55 315 62 315 75V94C315 99 312 101 307 101H296V38Z"/><path d="M358 38H366C371 38 374 41 374 46V93C374 98 371 101 366 101H358C353 101 350 98 350 93V46C350 41 353 38 358 38Z"/><circle cx="362" cy="22" r="11"/></g></svg>`

const SYSTEMS = {
  win: { label: 'Windows', pattern: /-setup\.exe$/, requires: 'Windows 10 ou 11' },
  mac: { label: 'Mac', pattern: /\.dmg$/, requires: 'Apple Silicon (M1 ou mais novo)' }
}

/** Instalador de `os` publicado no site para `release`, com o tamanho, ou nada. */
function installer(release, files, os) {
  const file = files.find((file) => file.tag === release.tag && SYSTEMS[os].pattern.test(file.name))
  if (!file) return null
  const asset = release.assets.find((asset) => asset.name === file.name)
  return { os, name: file.name, size: asset?.size }
}

function choice({ os, name, size }, primary, label = `Baixar para ${SYSTEMS[os].label}`) {
  const meta = [SYSTEMS[os].requires, size && megabytes(size)].filter(Boolean).join(' · ')
  return [
    `<div class="choice" data-os="${os}">`,
    `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" href="${escape(name)}" download>${ICONS.download}<span>${escape(label)}</span></a>`,
    `<span class="meta">${escape(meta)}</span>`,
    '</div>'
  ].join('')
}

/**
 * Bloco de download. Sem script aparecem os dois botões (Windows primeiro). O script mostra só o do
 * sistema de quem visita, com um link para o outro; no celular ou num sistema desconhecido, troca os
 * dois botões por um seletor Windows/Mac e um botão só.
 */
function download(options) {
  const [first, second] = options
  return [
    '<div class="download" data-download>',
    second
      ? `<div class="os-switch" data-os-switch hidden><i class="thumb" aria-hidden="true"></i>${options.map((option) => `<button type="button" data-pick="${option.os}" aria-pressed="${option === first}">${SYSTEMS[option.os].label}</button>`).join('')}</div>`
      : '',
    `<div class="choices" data-choices>${options.map((option, index) => choice(option, index === 0)).join('')}</div>`,
    second ? '<p class="other meta" data-other hidden></p>' : '',
    '</div>'
  ].join('')
}

/** Título com cada palavra numa caixa própria, para entrarem uma depois da outra. */
function words(lines) {
  let index = 0
  return lines
    .map(
      (line, row) =>
        `<span class="line${row > 0 ? ' line-soft' : ''}">${line
          .split(' ')
          .map((word) => `<span class="word" style="--i:${index++}">${escape(word)}</span>`)
          .join(' ')}</span>`
    )
    .join(' ')
}

function preview() {
  return `<div class="shot" data-reveal data-agenda>
<div class="shot-glow" aria-hidden="true"></div>
${windowHtml()}
<p class="shot-hint">${ICONS.pointer}<span>Experimente: clique num horário livre para agendar, numa sessão para ver os detalhes, ou troque entre Dia, Semana e Mês.</span></p>
</div>`
}

const FEATURES = [
  [
    'calendar',
    'Agenda da clínica',
    'Dia, semana ou mês, com o horário de agora sempre à vista e as sessões de cada paciente.'
  ],
  [
    'clipboard',
    'Fichas e anamnese',
    'Cadastro completo e anamnese em roteiro, um tema por vez, junto do registro de cada sessão.'
  ],
  [
    'lock',
    'Seus dados, no seu computador',
    'Os dados ficam no computador da clínica, e uma cópia cifrada vai para o Drive, OneDrive ou iCloud que ela já usa.'
  ],
  [
    'network',
    'Recepção e consultório',
    'O consultório usa os mesmos dados da recepção, pela rede da clínica ou pela internet.'
  ]
]

/**
 * HTML da página. `stable` e `alpha` são `{ tag, publishedAt, assets: [{ name, size }] }` (ou nada);
 * `files` é a saída de `siteFiles`. O topo mostra a estável (ou o alpha, se ainda não houver estável).
 */
export function downloadPage({ stable, alpha, files }) {
  const main = stable ?? alpha
  const isAlpha = main === alpha
  const win = installer(main, files, 'win')
  const mac = installer(main, files, 'mac')
  const options = [win, mac].filter(Boolean)
  const version = main.tag.slice(1)
  const missing = !mac
    ? 'Ainda não há versão para Mac.'
    : !win
      ? 'Ainda não há versão para Windows.'
      : ''
  const versionLine = `${isAlpha ? '<span class="chip">Alpha</span>' : ''}<span>Versão ${escape(version)} · ${date(main.publishedAt)}</span>`

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baixar o Auri ${escape(version)}</title>
<meta name="description" content="Agenda, fichas e sessões da clínica, guardadas no seu computador. Instaladores do Auri para Windows e Mac.">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f0f12" media="(prefers-color-scheme: dark)">
<link rel="icon" href="auri.svg" type="image/svg+xml">
<link rel="preload" href="bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
<script>(() => { const root = document.documentElement; root.classList.add('js'); try { const theme = localStorage.getItem('auri-theme'); if (theme === 'light' || theme === 'dark') root.dataset.theme = theme } catch {} })()</script>
<script type="module" src="page.js"></script>
</head>
<body>
<div class="backdrop" aria-hidden="true"></div>
<header class="top">
<a class="top-brand" href="./">${WORDMARK}</a>
<button type="button" class="theme-toggle" data-theme-toggle aria-label="Tema: igual ao sistema" title="Tema: igual ao sistema"><span data-theme-icon="system">${ICONS.monitor}</span><span data-theme-icon="light">${ICONS.sun}</span><span data-theme-icon="dark">${ICONS.moon}</span></button>
</header>
<main>
<section class="hero" id="baixar" aria-labelledby="titulo">
<div class="mark" aria-hidden="true"><i></i><i></i><i></i><img src="auri.svg" alt="" width="96" height="96"></div>
<h1 id="titulo">${words(['Agenda e fichas,', 'num lugar só.'])}</h1>
<p class="lead">Os pacientes, as sessões e as anamneses da clínica, guardados no computador dela e funcionando mesmo sem internet.</p>
<p class="note" data-mobile hidden>O Auri é para computador. Abra esta página no Windows ou no Mac da clínica.</p>
${download(options)}
${missing ? `<p class="missing meta">${missing}</p>` : ''}
<p class="version meta">${versionLine}</p>
</section>
${preview()}
<section class="section" aria-labelledby="recursos">
<h2 id="recursos" data-reveal>Feito para o dia a dia da clínica</h2>
<div class="features">
${FEATURES.map(([name, title, text], index) => `<article class="card" data-reveal data-spotlight style="--i:${index}"><span class="card-icon">${ICONS[name]}</span><h3>${title}</h3><p>${text}</p></article>`).join('\n')}
</div>
</section>
<section class="section closing" aria-labelledby="fim">
<h2 id="fim" data-reveal>Comece hoje</h2>
<div data-reveal style="--i:1"><a class="btn btn-primary" href="#baixar" data-to-download>${ICONS.arrowUp}<span>Baixar o Auri</span></a></div>
</section>
</main>
<footer class="foot"><span>${WORDMARK}</span><span class="meta">${versionLine}</span></footer>
</body>
</html>
`
}
