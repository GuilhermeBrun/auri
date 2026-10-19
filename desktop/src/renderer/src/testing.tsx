import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { emptyPatientInput, type Appointment, type Patient } from '@shared/schemas'
import { ToastContext, type ToastInput } from '@renderer/lib/toast'

export function fakePatient(over: Partial<Patient> = {}): Patient {
  return {
    ...emptyPatientInput(),
    id: 1,
    nome: 'Helena Fictícia Andrade',
    data_nascimento: '2019-08-17',
    mae_nome: 'Marina Fictícia Andrade',
    data_entrada: '2026-08-29',
    ativo: true,
    created_at: '2026-08-29T12:00:00.000Z',
    updated_at: '2026-08-29T12:00:00.000Z',
    ...over
  }
}

let nextId = 100

export function fakeAppointment(over: Partial<Appointment> & { inicio: string }): Appointment {
  const [day, time] = over.inicio.split('T')
  const [h, m] = time.split(':').map(Number)
  const end = new Date(2000, 0, 1, h, m + 30)
  return {
    id: nextId++,
    patient_id: 1,
    patient_nome: 'Helena Fictícia Andrade',
    fim: `${day}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
    observacao: '',
    tipo: 'sessao',
    presenca: '',
    evolucao: '',
    assinatura: null,
    created_at: '2026-08-29T12:00:00.000Z',
    updated_at: '2026-08-29T12:00:00.000Z',
    ...over
  }
}

export function renderRoute(
  path: string,
  pattern: string,
  element: ReactNode,
  toast: (input: ToastInput) => void = () => {}
): RenderResult & { client: QueryClient } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <ToastContext value={toast}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={pattern} element={element} />
            <Route path="*" element={<p>Outra tela</p>} />
          </Routes>
        </MemoryRouter>
      </ToastContext>
    </QueryClientProvider>
  )
  return { ...result, client }
}
