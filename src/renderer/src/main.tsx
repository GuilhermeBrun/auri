import '@fontsource-variable/bricolage-grotesque/opsz.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './assets/main.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'

// Os dados são locais: não há rede para repetir nem foco de janela para revalidar. E só mudam pelas
// próprias telas, que invalidam o cache ao salvar; então voltar a uma tela usa o que já está em
// memória (staleTime infinito), sem buscar de novo nem redesenhar duas vezes.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    mutations: { retry: false }
  }
})

document.documentElement.dataset.platform = window.platform

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
)
