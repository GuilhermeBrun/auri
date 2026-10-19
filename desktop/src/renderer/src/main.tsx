import '@fontsource-variable/bricolage-grotesque/opsz.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './assets/main.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    mutations: { retry: false }
  }
})

window.api.onChanged((topics) => {
  if (topics.includes('patients')) {
    void queryClient.invalidateQueries({ queryKey: ['patients'] })
    void queryClient.invalidateQueries({ queryKey: ['patient'], refetchType: 'none' })
  }
  if (topics.includes('appointments')) {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
  }
  if (topics.includes('anamneses')) {
    void queryClient.invalidateQueries({ queryKey: ['anamnese'], refetchType: 'none' })
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
