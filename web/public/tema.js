// Antes da primeira pintura: liga as animações (.js) e aplica o tema guardado. Fica num arquivo
// (e não inline) para a CSP do site aceitar só scripts do próprio domínio.
;(() => {
  const root = document.documentElement
  root.classList.add('js')
  try {
    const theme = localStorage.getItem('auri-theme')
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  } catch {
    // sem armazenamento (janela anônima): fica o tema do sistema
  }
})()
