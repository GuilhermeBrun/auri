import type {
  Anamnese,
  Appointment,
  AttendanceRecord,
  Clinic,
  Patient,
  TermModel,
  TermRequest
} from '@shared/schemas'
import type { Sugestao } from '@shared/encaixe'
import type { EncaixeNaVaga, SugestaoPedido, Vaga, WaitlistEntry } from '@shared/waitlist'

type Query<T> = { queryKey: readonly unknown[]; queryFn: () => Promise<T> }

export function patientsQuery(incluirInativos: boolean): Query<Patient[]> {
  return {
    queryKey: ['patients', { incluirInativos }],
    queryFn: () => window.api.patients.list({ incluirInativos })
  }
}

export function appointmentsQuery({ de, ate }: { de: string; ate: string }): Query<Appointment[]> {
  return {
    queryKey: ['appointments', de, ate],
    queryFn: () => window.api.appointments.listRange(de, ate)
  }
}

export function patientQuery(id: number): Query<Patient> {
  return { queryKey: ['patient', id], queryFn: () => window.api.patients.get(id) }
}

export function patientAppointmentsQuery(patientId: number): Query<Appointment[]> {
  return {
    queryKey: ['appointments', 'patient', patientId],
    queryFn: () => window.api.appointments.listByPatient(patientId)
  }
}

export function anamneseQuery(patientId: number): Query<Anamnese> {
  return { queryKey: ['anamnese', patientId], queryFn: () => window.api.anamneses.get(patientId) }
}

export function patientAttendanceQuery(patientId: number): Query<AttendanceRecord[]> {
  return {
    queryKey: ['attendance', patientId],
    queryFn: () => window.api.attendance.listByPatient(patientId)
  }
}

export function clinicQuery(): Query<Clinic> {
  return { queryKey: ['clinic'], queryFn: () => window.api.clinic.get() }
}

export function termModelsQuery(): Query<TermModel[]> {
  return { queryKey: ['terms', 'models'], queryFn: () => window.api.terms.models() }
}

export function patientTermsQuery(patientId: number): Query<TermRequest[]> {
  return {
    queryKey: ['terms', 'patient', patientId],
    queryFn: () => window.api.terms.listByPatient(patientId)
  }
}

export function waitlistQuery(): Query<WaitlistEntry[]> {
  return { queryKey: ['waitlist'], queryFn: () => window.api.waitlist.list() }
}

export function patientWaitlistQuery(patientId: number): Query<WaitlistEntry | null> {
  return {
    queryKey: ['waitlist', 'patient', patientId],
    queryFn: () => window.api.waitlist.getByPatient(patientId)
  }
}

export function sugestoesQuery(pedido: SugestaoPedido): Query<Sugestao[]> {
  return {
    queryKey: ['encaixe', 'sugerir', pedido],
    queryFn: () => window.api.encaixe.sugerir(pedido)
  }
}

export function quemCabeQuery(vaga: Vaga): Query<EncaixeNaVaga[]> {
  return {
    queryKey: ['encaixe', 'quemCabe', vaga],
    queryFn: () => window.api.encaixe.quemCabe(vaga)
  }
}
