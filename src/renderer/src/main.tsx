import '@fontsource-variable/bricolage-grotesque/opsz.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './assets/main.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'

// Os dados mudam só por dois caminhos: as próprias telas, que invalidam o cache ao salvar, e os
// avisos do main (`onChanged`: outro computador salvou, a conexão voltou, o papel mudou). Então
// voltar a uma tela usa o que já está em memória (staleTime infinito), sem buscar de novo nem
// redesenhar duas vezes; também não há foco de janela para revalidar. Pedidos que falham não são
// repetidos: uma gravação repetida pela rede poderia criar uma sessão em dobro.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    mutations: { retry: false }
  }
})

window.api.onChanged((topics) => {
  if (topics.includes('patients')) {
    void queryClient.invalidateQueries({ queryKey: ['patients'] })
    // A ficha aberta não é recarregada por baixo de quem está editando (o formulário seria
    // refeito e perderia o que foi digitado); só fica velha, e é buscada de novo ao reabrir. Se
    // alguém salvar a versão velha, o main recusa (`updated_at`).
    void queryClient.invalidateQueries({ queryKey: ['patient'], refetchType: 'none' })
  }
  if (topics.includes('appointments')) {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
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
