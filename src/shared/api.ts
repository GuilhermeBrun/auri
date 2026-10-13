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
    /** `expected`: o `updated_at` de quando a ficha foi aberta (recusa se outra pessoa salvou depois). */
    update(id: number, input: PatientInput, expected?: string): Promise<Patient>
    setAtivo(id: number, ativo: boolean): Promise<Patient>
  }
  appointments: {
    /** Agendamentos que se sobrepõem ao intervalo [de, ate), em data/hora local AAAA-MM-DDTHH:mm. */
    listRange(de: string, ate: string): Promise<Appointment[]>
    create(input: AppointmentInput): Promise<Appointment>
    /** `expected`: ver `patients.update`. */
    update(id: number, input: AppointmentInput, expected?: string): Promise<Appointment>
    remove(id: number): Promise<void>
  }
  /**
   * Avisa quando os dados mudaram fora desta tela (outro computador, ou troca de papel em
   * Configurações / Conexão, quando `topics` traz tudo). Devolve a função que cancela o aviso.
   */
  onChanged(listener: (topics: DataTopic[]) => void): () => void
}

/** Partes dos dados que mudam juntas (cada uma invalida as suas consultas nas telas). */
export const DATA_TOPICS = ['patients', 'appointments'] as const
export type DataTopic = (typeof DATA_TOPICS)[number]

/** Resposta do IPC: erros viajam como mensagem legível em vez de exceção. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Preferências da interface, expostas em window.prefs. Os valores chegam prontos na abertura, como
 * argumento da janela, e `save` manda gravar sem esperar: o localStorage faria a primeira tela
 * esperar o disco (ver main/prefs.ts).
 */
export interface AuriPrefs {
  initial: UiPrefs
  /** Grava só os campos informados; os outros ficam como estão. */
  save(prefs: Partial<UiPrefs>): void
}

/**
 * Preferências de quem ainda não escolheu nada. Fica aqui, e não em schemas.ts, porque o preload
 * (em sandbox) não pode importar o zod.
 */
export const DEFAULT_UI_PREFS: UiPrefs = { sidebarOpen: true, theme: 'system' }

/** Argumento da janela que leva as preferências do main ao preload. */
export const PREFS_ARG = '--auri-prefs='

/** Papel deste computador: guarda os dados (recepção) ou usa os de outro (consultório). */
export type ConnectionRole = 'server' | 'client'

/**
 * Como este computador está chegando aos dados.
 * - `local`: guarda os próprios dados (papel servidor).
 * - `unpaired`: papel cliente, ainda sem computador escolhido.
 * - `connecting`: tentando a primeira conexão desde que o app abriu (ou desde a troca de papel).
 * - `connected` / `offline`: conectou; ou perdeu a conexão e está tentando de novo.
 * - `version`: os dois Auri estão em versões diferentes; nada é lido nem gravado.
 * - `revoked`: o outro computador removeu este da lista.
 */
export type LinkStatus =
  'local' | 'unpaired' | 'connecting' | 'connected' | 'offline' | 'version' | 'revoked'

/** Um computador que pode usar os dados deste. */
export type PairedDevice = {
  publicKey: string
  name: string
  online: boolean
  /** ISO; null se nunca conectou depois do pareamento. */
  lastSeen: string | null
}

/** Um Auri que compartilha dados, encontrado na rede local. */
export type FoundServer = { name: string; publicKey: string; host: string; port: number }

export type ConnectionInfo = {
  role: ConnectionRole
  /** Nome deste computador, como os outros o veem. */
  name: string
  status: LinkStatus
  // Papel servidor
  sharing: boolean
  /** Por que o compartilhamento não subiu (ex.: porta em uso). */
  sharingError: string | null
  keepRunning: boolean
  openAtLogin: boolean
  /** Endereços deste computador na rede (para digitar no outro, se a busca não achar). */
  addresses: string[]
  devices: PairedDevice[]
  // Papel cliente
  server: { name: string; publicKey: string; address: string | null } | null
}

export type PairingCode = { code: string; expiresAt: number }

/** Configurações / Conexão. Exposto em window.connection pelo preload. */
export interface AuriConnection {
  info(): Promise<ConnectionInfo>
  /** Avisa a cada mudança (estado, computadores online, papel). Devolve a função que cancela. */
  onChange(listener: (info: ConnectionInfo) => void): () => void
  setRole(role: ConnectionRole): Promise<ConnectionInfo>
  setName(name: string): Promise<ConnectionInfo>
  setSharing(on: boolean): Promise<ConnectionInfo>
  setKeepRunning(on: boolean): Promise<ConnectionInfo>
  setOpenAtLogin(on: boolean): Promise<ConnectionInfo>
  createCode(): Promise<PairingCode>
  cancelCode(): Promise<void>
  removeDevice(publicKey: string): Promise<ConnectionInfo>
  /** Procura na rede local por alguns segundos. */
  discover(): Promise<FoundServer[]>
  /** `address`: "host" ou "host:porta". */
  pair(address: string, code: string): Promise<ConnectionInfo>
  /** Esquece o computador e volta a `unpaired`. */
  forget(): Promise<ConnectionInfo>
  /** Tenta conectar agora, sem esperar o próximo intervalo. */
  retry(): Promise<void>
}
