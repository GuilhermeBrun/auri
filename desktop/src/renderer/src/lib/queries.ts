import type { Anamnese, Appointment, Patient } from '@shared/schemas'

type Query<T> = { queryKey: readonly unknown[]; queryFn: () => Promise<T> }

/**
 * Pacientes ativos (ou todos), em ordem alfabética. A lista inteira fica em cache e a busca filtra
 * na própria tela (`createPatientSearch`): o resultado sai na mesma tecla, sem esperar o banco. A
 * tela Pacientes e a escolha de paciente do agendamento usam a mesma entrada do cache.
 */
export function patientsQuery(incluirInativos: boolean): Query<Patient[]> {
  return {
    queryKey: ['patients', { incluirInativos }],
    queryFn: () => window.api.patients.list({ incluirInativos })
  }
}

/** Agendamentos que se sobrepõem a [de, ate), em data/hora local. */
export function appointmentsQuery({ de, ate }: { de: string; ate: string }): Query<Appointment[]> {
  return {
    queryKey: ['appointments', de, ate],
    queryFn: () => window.api.appointments.listRange(de, ate)
  }
}

/** Uma ficha. A ficha, a anamnese e as sessões do paciente usam a mesma entrada. */
export function patientQuery(id: number): Query<Patient> {
  return { queryKey: ['patient', id], queryFn: () => window.api.patients.get(id) }
}

/** Todas as sessões do paciente. Fica sob 'appointments': salvar na agenda atualiza o histórico. */
export function patientAppointmentsQuery(patientId: number): Query<Appointment[]> {
  return {
    queryKey: ['appointments', 'patient', patientId],
    queryFn: () => window.api.appointments.listByPatient(patientId)
  }
}

export function anamneseQuery(patientId: number): Query<Anamnese> {
  return { queryKey: ['anamnese', patientId], queryFn: () => window.api.anamneses.get(patientId) }
}
