import '@fontsource-variable/bricolage-grotesque/opsz.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './assets/main.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

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
  if (topics.includes('attendance')) {
    void queryClient.invalidateQueries({ queryKey: ['attendance'] })
  }
  if (topics.includes('anamneses')) {
    void queryClient.invalidateQueries({ queryKey: ['anamnese'], refetchType: 'none' })
  }
})

document.documentElement.dataset.platform = window.platform

function report(error: unknown): void {
  const value = (error instanceof Error ? error : { message: String(error) }) as Error
  window.reports.error({ name: value.name, message: value.message, stack: value.stack })
}

window.addEventListener('error', (event) => report(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => report(event.reason))

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error) => {
    console.error(error)
    report(error)
  },
  onCaughtError: (error) => {
    console.error(error)
    report(error)
  }
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
)
