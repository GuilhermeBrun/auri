// Página de download: tema, botão pelo sistema de quem visita, entradas conforme a rolagem, luz
// nos cards e a prévia da agenda respondendo a cliques. Sem este script a página continua inteira,
// com os dois botões e a agenda parada.
import {
  DAY_END,
  FIRST,
  ICONS,
  LENGTH,
  NAMES,
  TODAY,
  body,
  clock,
  createStore,
  dateOf,
  initialState,
  overlaps,
  shortDate,
  tools,
  trail
} from './agenda.mjs'

const root = document.documentElement

// Tema: igual ao sistema (padrão), claro ou escuro. A escolha fica neste navegador.
const THEMES = ['system', 'light', 'dark']
const THEME_LABELS = { system: 'igual ao sistema', light: 'claro', dark: 'escuro' }
const themeButton = document.querySelector('[data-theme-toggle]')
function applyTheme(theme) {
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  themeButton.dataset.current = theme
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
  themeButton.setAttribute(
    'aria-label',
    `Tema: ${THEME_LABELS[theme]}. Mudar para ${THEME_LABELS[next]}`
  )
  themeButton.title = `Tema: ${THEME_LABELS[theme]}`
}
applyTheme(root.dataset.theme ?? 'system')
themeButton.addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(themeButton.dataset.current) + 1) % THEMES.length]
  applyTheme(next)
  try {
    if (next === 'system') localStorage.removeItem('auri-theme')
    else localStorage.setItem('auri-theme', next)
  } catch {
    // sem armazenamento (janela anônima): o tema vale só até fechar a página
  }
})

const ua = navigator.userAgent
const mobile =
  /Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
const platform = navigator.userAgentData?.platform || navigator.platform || ua
const system = mobile ? null : /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'win' : null

if (mobile) document.querySelector('[data-mobile]').hidden = false

/** Desliza o bloco `.thumb` de um seletor até o botão escolhido. */
function moveThumb(group, button, animate = true) {
  const thumb = group?.querySelector('.thumb')
  if (!thumb || !button) return
  thumb.style.transition = animate ? '' : 'none'
  thumb.style.width = `${button.offsetWidth}px`
  thumb.style.transform = `translateX(${button.offsetLeft}px)`
}

// Download: no computador, só o botão do sistema detectado e um link para o outro; no celular ou num
// sistema desconhecido, um seletor Windows/Mac e um botão só.
for (const block of document.querySelectorAll('[data-download]')) {
  const choices = [...block.querySelectorAll('.choice')]
  if (choices.length < 2) continue
  const switcher = block.querySelector('[data-os-switch]')
  const other = block.querySelector('[data-other]')
  const show = (os) => {
    for (const choice of choices) {
      const on = choice.dataset.os === os
      choice.hidden = !on
      choice.querySelector('.btn').classList.toggle('btn-primary', on)
      choice.querySelector('.btn').classList.toggle('btn-secondary', !on)
    }
  }

  if (system && choices.some((choice) => choice.dataset.os === system)) {
    show(system)
    const rest = choices.find((choice) => choice.dataset.os !== system)
    const link = rest.querySelector('.btn')
    other.innerHTML = `Também para <a href="${link.getAttribute('href')}" download>${rest.dataset.os === 'mac' ? 'Mac' : 'Windows'}</a>`
    other.hidden = false
  } else {
    switcher.hidden = false
    const buttons = [...switcher.querySelectorAll('button')]
    const pick = (os, animate) => {
      for (const button of buttons) button.setAttribute('aria-pressed', button.dataset.pick === os)
      moveThumb(
        switcher,
        buttons.find((button) => button.dataset.pick === os),
        animate
      )
      show(os)
    }
    for (const button of buttons) {
      button.addEventListener('click', () => pick(button.dataset.pick, true))
    }
    pick(choices[0].dataset.os, false)
    void document.fonts?.ready.then(() =>
      pick(
        buttons.find((button) => button.getAttribute('aria-pressed') === 'true').dataset.pick,
        false
      )
    )
  }
}

// "Baixar o Auri" no fim da página: rola até o download do topo e põe o foco no botão
document.querySelector('[data-to-download]')?.addEventListener('click', (event) => {
  event.preventDefault()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('baixar').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  document.querySelector('#baixar .choice:not([hidden]) .btn')?.focus({ preventScroll: true })
})

// Entradas conforme a rolagem
const revealed = document.querySelectorAll('[data-reveal]')
const reveal = (element) => {
  element.classList.add('in')
  if (element.matches('[data-agenda]')) startAgenda(element)
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        reveal(entry.target)
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
  )
  for (const element of revealed) observer.observe(element)
} else {
  for (const element of revealed) reveal(element)
}

// Luz que acompanha o ponteiro nos cards (só com mouse; no toque não há hover)
for (const card of document.querySelectorAll('[data-spotlight]')) {
  card.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    const box = card.getBoundingClientRect()
    card.style.setProperty('--x', `${event.clientX - box.left}px`)
    card.style.setProperty('--y', `${event.clientY - box.top}px`)
  })
}

// ---------------------------------------------------------------------------------------------
// Prévia da agenda: agendar num horário livre (ou no +), abrir uma sessão e excluí-la, navegar,
// trocar entre Dia, Semana e Mês e abrir a lista de pacientes. Tudo fictício e só nesta página.

const shortName = (name) => name.split(' ').slice(0, 2).join(' ')

function startAgenda(shot) {
  if (shot.dataset.started) return
  shot.dataset.started = 'true'
  const win = shot.querySelector('.win')
  const main = win.querySelector('.win-main')
  const area = win.querySelector('[data-body]')
  const trailEl = win.querySelector('[data-trail]')
  const toolsEl = win.querySelector('[data-tools]')
  const nav = win.querySelector('.win-nav')
  const pop = win.querySelector('[data-pop]')
  const toast = win.querySelector('[data-toast]')
  const store = createStore()
  const state = initialState()
  let nameIndex = 0
  // Coluna estreita (celular): a visão Dia, que cabe com o texto legível
  if (shot.clientWidth <= 720) {
    state.mode = 'day'
    queueMicrotask(() => render())
  }

  function render(enter) {
    closePop()
    state.arrived = typeof enter === 'number' ? enter : null
    trailEl.innerHTML = trail(state)
    toolsEl.innerHTML = tools(state)
    area.innerHTML = body(state, store, enter)
    for (const button of nav.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-pressed', button.dataset.view === state.view)
    }
    nav.style.setProperty('--active', state.view === 'patients' ? 1 : 0)
    const modes = toolsEl.querySelector('[data-modes]')
    moveThumb(modes, modes?.querySelector('[aria-pressed="true"]'), false)
  }

  let toastTimer
  function showToast(icon, title, text) {
    toast.querySelector('[data-toast-icon]').innerHTML = icon
    toast.querySelector('[data-toast-title]').textContent = title
    toast.querySelector('[data-toast-text]').textContent = text
    toast.classList.remove('show')
    void toast.offsetWidth
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000)
  }

  function nextName(day) {
    const taken = new Set(store.day(day).map((session) => session.name))
    for (let tries = 0; tries < NAMES.length; tries++) {
      const name = NAMES[nameIndex++ % NAMES.length]
      if (!taken.has(name)) return name
    }
    return NAMES[0]
  }

  function schedule(day, start) {
    const session = store.add(day, start, nextName(day))
    render(session.id)
    showToast(
      ICONS.check,
      'Sessão agendada',
      `${shortName(session.name)} · ${shortDate(day)} às ${clock(start)}`
    )
  }

  function openPop(button) {
    const session = store.find(Number(button.dataset.id))
    if (!session) return
    state.selected = session.id
    for (const item of area.querySelectorAll('.ev')) {
      item.classList.toggle('selected', item.dataset.id === button.dataset.id)
    }
    const date = dateOf(session.day)
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
    const month = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
    pop.innerHTML = `<b>${session.name}</b><span>${weekday}, ${date.getUTCDate()} de ${month}</span><span>${clock(session.start)} – ${clock(session.start + session.len)} · ${Math.round(session.len * 60)} min</span><div class="pop-actions"><button type="button" class="pop-danger" data-delete="${session.id}">${ICONS.trash}Excluir</button><button type="button" data-close>Fechar</button></div>`
    pop.hidden = false
    const box = main.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    const gap = 8
    let left = target.right - box.left + gap
    if (left + pop.offsetWidth > box.width - gap) {
      left = target.left - box.left - pop.offsetWidth - gap
    }
    // Sessão larga (visão Dia): sem espaço dos lados, o cartão fica por cima, no canto direito dela
    if (left < gap) left = target.right - box.left - pop.offsetWidth - gap
    const top = Math.min(target.top - box.top, box.height - pop.offsetHeight - gap)
    pop.style.left = `${Math.max(gap, left)}px`
    pop.style.top = `${Math.max(gap, top)}px`
    pop.querySelector('[data-close]').focus({ preventScroll: true })
  }

  function closePop() {
    pop.hidden = true
  }

  // Horário livre sob o ponteiro: a seleção do app ("10:00 – 10:45"), que o clique agenda
  const ghost = document.createElement('div')
  ghost.className = 'ghost'
  ghost.setAttribute('aria-hidden', 'true')
  function slotAt(event) {
    const column = event.target.closest('.col')
    if (!column || event.target.closest('.ev')) return null
    const box = column.getBoundingClientRect()
    // a coluna mostra 8 horas: cada meia hora é 1/16 da altura
    const half = box.height / 16
    const start = Math.min(
      FIRST + Math.floor((event.clientY - box.top) / half) * 0.5,
      DAY_END - LENGTH
    )
    const day = Number(column.dataset.day)
    const busy = store.day(day).some((session) => overlaps(session, start, LENGTH))
    return busy ? null : { column, day, start }
  }

  area.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    const slot = slotAt(event)
    if (!slot) return ghost.remove()
    ghost.style.setProperty('--top', slot.start - FIRST)
    ghost.textContent = `${clock(slot.start)} – ${clock(slot.start + LENGTH)}`
    if (ghost.parentNode !== slot.column) slot.column.append(ghost)
  })
  area.addEventListener('pointerleave', () => ghost.remove())

  win.addEventListener('click', (event) => {
    const target = event.target
    if (pop.contains(target)) {
      if (target.closest('[data-close]')) closePop()
      const remove = target.closest('[data-delete]')
      if (remove) {
        const session = store.remove(Number(remove.dataset.delete))
        state.selected = null
        render()
        if (session) {
          showToast(
            ICONS.trash,
            'Agendamento excluído',
            `${shortName(session.name)} · ${shortDate(session.day)}`
          )
        }
      }
      return
    }
    ready()
    const eventButton = target.closest('.ev')
    if (eventButton) return openPop(eventButton)
    const day = target.closest('[data-day]')
    const step = target.closest('[data-step]')
    const mode = target.closest('[data-mode]')
    const view = target.closest('[data-view]')
    if (target.closest('[data-today]')) {
      state.focus = TODAY
      return render('all')
    }
    if (target.closest('[data-new]')) {
      // como o "+" do app: o próximo horário livre de hoje, depois de agora
      const sessions = store.day(TODAY)
      for (let start = 10.5; start <= DAY_END - LENGTH; start += 0.5) {
        if (!sessions.some((session) => overlaps(session, start, LENGTH))) {
          state.focus = TODAY
          if (state.mode === 'month') state.mode = 'week'
          return schedule(TODAY, start)
        }
      }
      return
    }
    if (step) {
      const amount = Number(step.dataset.step)
      if (state.mode === 'day') state.focus += amount
      else if (state.mode === 'week') state.focus += amount * 7
      else {
        const date = dateOf(state.focus)
        const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)
        state.focus = Math.round((next - dateOf(0).getTime()) / 86400000)
      }
      return render('all')
    }
    if (mode) {
      state.mode = mode.dataset.mode
      return render('all')
    }
    if (view) {
      state.view = view.dataset.view
      return render('all')
    }
    if (day && (day.matches('.dh, .mc-num, .more') || state.mode === 'month')) {
      if (state.mode === 'day') state.mode = 'week'
      else Object.assign(state, { mode: 'day', focus: Number(day.dataset.day) })
      return render('all')
    }
    const slot = slotAt(event)
    if (slot) {
      ghost.remove()
      return schedule(slot.day, slot.start)
    }
    closePop()
  })

  win.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !pop.hidden) {
      closePop()
      area.querySelector('.ev.selected')?.focus()
    }
  })

  // A entrada inicial (sessões aparecendo uma a uma e o aviso) é do CSS; depois dela, cada
  // mudança anima só o que mudou.
  let isReady = false
  function ready() {
    if (isReady) return
    isReady = true
    shot.classList.add('ready')
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  setTimeout(
    () => {
      showToast(ICONS.check, 'Sessão agendada', 'Alice Costa · qua, 21 de out às 10:30')
      setTimeout(ready, 600)
    },
    reduced ? 0 : 2200
  )
  const modes = toolsEl.querySelector('[data-modes]')
  moveThumb(modes, modes.querySelector('[aria-pressed="true"]'), false)
  void document.fonts?.ready.then(() =>
    moveThumb(modes, toolsEl.querySelector('[data-modes] [aria-pressed="true"]'), false)
  )
}
