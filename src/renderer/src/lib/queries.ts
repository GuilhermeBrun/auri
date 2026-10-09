import type { Appointment, Patient } from '@shared/schemas'

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
