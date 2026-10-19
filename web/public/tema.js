;(() => {
  const root = document.documentElement
  root.classList.add('js')
  try {
    const theme = localStorage.getItem('auri-theme')
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  } catch {}
})()
