import type {
  Appointment,
  AppointmentInput,
  Patient,
  PatientFilter,
  PatientInput,
  UiPrefs
} from './schemas'

/** Contrato entre as telas (renderer) e o processo main. Exposto em window.api pelo preload. */
export interface AuriApi {
  patients: {
    list(filter?: PatientFilter): Promise<Patient[]>
    get(id: number): Promise<Patient>
    create(input: PatientInput): Promise<Patient>
    update(id: number, input: PatientInput): Promise<Patient>
    setAtivo(id: number, ativo: boolean): Promise<Patient>
  }
  appointments: {
    /** Agendamentos que se sobrepõem ao intervalo [de, ate), em data/hora local AAAA-MM-DDTHH:mm. */
    listRange(de: string, ate: string): Promise<Appointment[]>
    create(input: AppointmentInput): Promise<Appointment>
    update(id: number, input: AppointmentInput): Promise<Appointment>
    remove(id: number): Promise<void>
  }
}

/** Resposta do IPC: erros viajam como mensagem legível em vez de exceção. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Preferências da interface, expostas em window.prefs. Os valores chegam prontos na abertura, como
 * argumento da janela, e `save` manda gravar sem esperar: o localStorage faria a primeira tela
 * esperar o disco (ver main/prefs.ts).
 */
export interface AuriPrefs {
  initial: UiPrefs
  save(prefs: UiPrefs): void
}

/** Argumento da janela que leva as preferências do main ao preload. */
export const PREFS_ARG = '--auri-prefs='
