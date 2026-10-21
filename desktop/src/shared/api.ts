import type {
  Anamnese,
  AnamneseInput,
  Appointment,
  AppointmentInput,
  ArrivalSignInput,
  AttendanceRecord,
  Clinic,
  ClinicInput,
  Patient,
  PatientFilter,
  PatientInput,
  TermCheck,
  TermLink,
  TermModel,
  TermModelInput,
  TermRequest,
  TermSendInput,
  TermSendResult,
  UiPrefs
} from './schemas'
import type { Commitment, CommitmentInput } from './commitments'
import type {
  AvisosDaConfirmacao,
  ConfirmacaoEnvio,
  ConfirmacaoLista,
  ConfirmacaoRecebida
} from './confirmacao'
import type { Intervalo, Sugestao } from './encaixe'
import type {
  EncaixeNaVaga,
  SugestaoPedido,
  Vaga,
  WaitlistAdd,
  WaitlistClose,
  WaitlistEntry,
  WaitlistInput
} from './waitlist'
import type { TipoAtendimento, TipoInput } from './tipos'
import type {
  Billing,
  BillingInput,
  ChargeInput,
  FinanceCatalog,
  FinanceInsurer,
  FinanceOverview,
  FinancePlan,
  FinanceService,
  InsurerInput,
  Lancamento,
  PackageInput,
  PatientFinance,
  PaymentInput,
  PlanInput,
  ServiceInput,
  SessionPayStatus
} from './finance'

export interface AuriApi {
  patients: {
    list(filter?: PatientFilter): Promise<Patient[]>
    get(id: number): Promise<Patient>
    create(input: PatientInput): Promise<Patient>
    update(id: number, input: PatientInput, expected?: string): Promise<Patient>
    setAtivo(id: number, ativo: boolean): Promise<Patient>
  }
  appointments: {
    listRange(de: string, ate: string): Promise<Appointment[]>
    listByPatient(patientId: number): Promise<Appointment[]>
    create(input: AppointmentInput): Promise<Appointment>
    update(
      id: number,
      input: AppointmentInput,
      expected: string | undefined,
      computador: string
    ): Promise<Appointment>
    remove(id: number): Promise<void>
    move(
      id: number,
      slot: Intervalo,
      expected: string | undefined,
      computador: string
    ): Promise<Appointment>
    scheduleOnReserve(reserveId: number, input: AppointmentInput): Promise<Appointment>
  }
  commitments: {
    listRange(de: string, ate: string): Promise<Commitment[]>
    create(input: CommitmentInput): Promise<Commitment>
    update(id: number, input: CommitmentInput, expected?: string): Promise<Commitment>
    remove(id: number): Promise<void>
  }
  attendance: {
    sign(appointmentId: number, input: ArrivalSignInput, computador: string): Promise<Appointment>
    void(signatureId: number, motivo: string, computador: string): Promise<Appointment>
    listByPatient(patientId: number): Promise<AttendanceRecord[]>
    reportPdf(patientId: number, de: string, ate: string): Promise<string | null>
  }
  documents: {
    evolutionsPdf(patientId: number, de: string, ate: string): Promise<string | null>
    patientPdf(patientId: number): Promise<void>
    anamnesePdf(patientId: number): Promise<void>
  }
  clinic: {
    get(): Promise<Clinic>
    save(input: ClinicInput, expected?: string): Promise<Clinic>
    chooseLogo(): Promise<string | null>
  }
  terms: {
    models(): Promise<TermModel[]>
    measureModel(input: TermModelInput): Promise<{ tamanho: number; limite: number }>
    saveModel(id: number | null, input: TermModelInput): Promise<TermModel>
    archiveModel(id: number, arquivado: boolean): Promise<TermModel>
    listByPatient(patientId: number): Promise<TermRequest[]>
    send(patientId: number, input: TermSendInput, computador: string): Promise<TermSendResult>
    link(requestId: number): Promise<TermLink>
    cancel(requestId: number): Promise<TermRequest>
    check(texto: string): Promise<TermCheck>
    accept(texto: string, computador: string): Promise<TermRequest>
    openWhatsApp(numero: string, texto: string): Promise<void>
    openPdf(signedId: number): Promise<void>
    takeIncoming(): Promise<string[]>
    onIncoming(listener: () => void): () => void
  }
  confirmacoes: {
    lista(): Promise<ConfirmacaoLista>
    enviar(appointmentId: number, computador: string): Promise<ConfirmacaoEnvio>
    receber(texto: string, computador: string): Promise<ConfirmacaoRecebida>
    aplicarOutra(requestId: number, computador: string): Promise<ConfirmacaoRecebida>
    avisos(): Promise<AvisosDaConfirmacao>
    dispensar(requestId: number, tipo: 'liberado' | 'outra'): Promise<void>
    takeIncoming(): Promise<string[]>
    onIncoming(listener: () => void): () => void
  }
  anamneses: {
    get(patientId: number): Promise<Anamnese>
    save(patientId: number, input: AnamneseInput, expected?: string): Promise<Anamnese>
  }
  tipos: {
    list(): Promise<TipoAtendimento[]>
    save(id: number | null, input: TipoInput): Promise<TipoAtendimento>
    archive(id: number, arquivado: boolean): Promise<TipoAtendimento>
  }
  waitlist: {
    list(): Promise<WaitlistEntry[]>
    getByPatient(patientId: number): Promise<WaitlistEntry | null>
    add(input: WaitlistAdd): Promise<WaitlistEntry>
    update(id: number, input: WaitlistInput, expected?: string): Promise<WaitlistEntry>
    close(id: number, close: WaitlistClose): Promise<void>
  }
  encaixe: {
    sugerir(input: SugestaoPedido): Promise<Sugestao[]>
    quemCabe(vaga: Vaga): Promise<EncaixeNaVaga[]>
  }
  finance: {
    catalog(): Promise<FinanceCatalog>
    saveService(id: number | null, input: ServiceInput): Promise<FinanceService>
    archiveService(id: number, arquivado: boolean): Promise<FinanceService>
    savePlan(id: number | null, input: PlanInput): Promise<FinancePlan>
    archivePlan(id: number, arquivado: boolean): Promise<FinancePlan>
    saveInsurer(id: number | null, input: InsurerInput): Promise<FinanceInsurer>
    archiveInsurer(id: number, arquivado: boolean): Promise<FinanceInsurer>
    patient(patientId: number): Promise<PatientFinance>
    setBilling(
      patientId: number,
      input: BillingInput,
      expected?: string,
      contratar?: { inicio: string; computador: string } | null
    ): Promise<Billing>
    renewPackage(patientId: number, computador: string): Promise<number>
    contractPackage(patientId: number, input: PackageInput, computador: string): Promise<number>
    charge(patientId: number, input: ChargeInput, computador: string): Promise<number>
    pay(patientId: number, input: PaymentInput, computador: string): Promise<number>
    launchSession(
      appointmentId: number,
      computador: string,
      serviceId?: number | null
    ): Promise<{ kind: 'charge' | 'use'; id: number }>
    chargeAbsence(appointmentId: number, computador: string): Promise<number>
    void(kind: Lancamento, id: number, motivo: string, computador: string): Promise<number>
    sessionStatus(appointmentIds: number[]): Promise<SessionPayStatus[]>
    overview(de: string, ate: string): Promise<FinanceOverview>
  }
  onChanged(listener: (topics: DataTopic[]) => void): () => void
}

export const DATA_TOPICS = [
  'patients',
  'appointments',
  'anamneses',
  'attendance',
  'clinic',
  'terms',
  'waitlist',
  'finance',
  'types',
  'commitments'
] as const
export type DataTopic = (typeof DATA_TOPICS)[number]

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface AuriPrefs {
  initial: UiPrefs
  save(prefs: Partial<UiPrefs>): void
  onChange(listener: (prefs: UiPrefs) => void): () => void
}

export const DEFAULT_UI_PREFS: UiPrefs = { sidebarOpen: true, theme: 'system', whatsapp: true }

export type WhatsAppBounds = { x: number; y: number; width: number; height: number }

export interface AuriWhatsApp {
  show(bounds: WhatsAppBounds): Promise<void>
  hide(): Promise<void>
  unread(): Promise<number>
  onUnread(listener: (count: number) => void): () => void
  onOpen(listener: () => void): () => void
}

export const PREFS_ARG = '--auri-prefs='

export type ConnectionRole = 'server' | 'client'

export type LinkStatus =
  | 'local'
  | 'unpaired'
  | 'connecting'
  | 'connected'
  | 'offline'
  | 'version'
  | 'revoked'

export type PairedDevice = {
  publicKey: string
  name: string
  online: boolean
  lastSeen: string | null
}

export type RemoteReach = 'starting' | 'open' | 'likely' | 'restricted' | 'offline'

export type LinkVia = 'local' | 'internet'

export type RemoteProbe = { ok: true; ms: number } | { ok: false; error: string }

export type FoundServer = { name: string; publicKey: string; host: string; port: number }

export type ConnectionInfo = {
  role: ConnectionRole
  name: string
  status: LinkStatus
  sharing: boolean
  sharingError: string | null
  keepRunning: boolean
  openAtLogin: boolean
  remoteAccess: boolean
  remoteReach: RemoteReach | null
  addresses: string[]
  devices: PairedDevice[]
  server: { name: string; publicKey: string; address: string | null } | null
  via: LinkVia | null
}

export type PairingCode = { code: string; expiresAt: number }

export interface AuriConnection {
  info(): Promise<ConnectionInfo>
  onChange(listener: (info: ConnectionInfo) => void): () => void
  setRole(role: ConnectionRole): Promise<ConnectionInfo>
  setName(name: string): Promise<ConnectionInfo>
  setSharing(on: boolean): Promise<ConnectionInfo>
  setKeepRunning(on: boolean): Promise<ConnectionInfo>
  setOpenAtLogin(on: boolean): Promise<ConnectionInfo>
  setRemoteAccess(on: boolean): Promise<ConnectionInfo>
  testRemote(): Promise<RemoteProbe>
  createCode(): Promise<PairingCode>
  cancelCode(): Promise<void>
  removeDevice(publicKey: string): Promise<ConnectionInfo>
  discover(): Promise<FoundServer[]>
  pair(address: string, code: string): Promise<ConnectionInfo>
  forget(): Promise<ConnectionInfo>
  retry(): Promise<void>
}

export type BackupFrequency = 'daily' | 'change' | 'manual'

export type CloudProviderId = 'google' | 'onedrive' | 'icloud'

export type BackupDestination = { kind: CloudProviderId | 'folder'; folder: string }

export type CloudState = 'ready' | 'signed-out' | 'closed' | 'off' | 'denied' | 'not-installed'

export type CloudProvider = {
  id: CloudProviderId
  name: string
  state: CloudState
  folder: string | null
}

export type InstallProgress = {
  id: CloudProviderId
  stage: 'downloading' | 'opening' | 'waiting' | 'error'
  progress: number | null
  error?: string
}

export type BackupInfo = {
  available: boolean
  configured: boolean
  destination: BackupDestination | null
  folderMissing: boolean
  frequency: BackupFrequency
  dailyTime: string
  running: boolean
  lastSuccessAt: string | null
  lastError: { at: string; message: string } | null
  stale: boolean
  undo: { at: string } | null
  welcome: boolean
  suggested: BackupDestination['kind'] | null
  destinationProblem: DestinationProblem | null
  stored: { count: number; bytes: number } | null
}

export type DestinationProblem = {
  state: CloudState
  folder: string | null
  message: string
}

export type BackupEntry = {
  file: string
  name: string
  createdAt: string
  counts: { patients: number; appointments: number }
  location: string
  own: boolean
}

export type BackupSecret = { password: string } | { recoveryCode: string }

export interface AuriBackup {
  info(): Promise<BackupInfo>
  onChange(listener: (info: BackupInfo) => void): () => void
  providers(): Promise<CloudProvider[]>
  chooseFolder(): Promise<string | null>
  setup(destination: BackupDestination, password: string): Promise<{ recoveryCode: string }>
  setDestination(destination: BackupDestination): Promise<BackupInfo>
  setFrequency(frequency: BackupFrequency, dailyTime: string): Promise<BackupInfo>
  runNow(): Promise<BackupInfo>
  openFolder(): Promise<void>
  changePassword(current: string, next: string): Promise<BackupInfo>
  resetPassword(recoveryCode: string, next: string): Promise<BackupInfo>
  newRecoveryCode(password: string): Promise<{ recoveryCode: string }>
  printRecoveryCode(code: string): Promise<void>
  disable(): Promise<BackupInfo>
  list(): Promise<BackupEntry[]>
  pickFile(): Promise<BackupEntry | null>
  restore(file: string, secret?: BackupSecret): Promise<BackupInfo>
  undoRestore(): Promise<BackupInfo>
  dismissWelcome(): Promise<BackupInfo>
  install(id: CloudProviderId): Promise<void>
  onInstallProgress(listener: (progress: InstallProgress) => void): () => void
  check(): Promise<BackupInfo>
  openProvider(id: CloudProviderId): Promise<void>
}

export type SettingsChange = { label: string; from: string; to: string }

export type SettingsPreview = {
  token: string
  name: string
  exportedAt: string
  changes: SettingsChange[]
}

export interface AuriTransfer {
  exportSettings(): Promise<string | null>
  pickSettings(): Promise<SettingsPreview | null>
  applySettings(token: string): Promise<void>
}

export type UpdateStatus = 'unavailable' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error'

export type UpdateChannel = 'latest' | 'alpha'

export type UpdateState = {
  version: string
  channel: UpdateChannel
  status: UpdateStatus
  next: string | null
  progress: number | null
  checkedAt: string | null
  error: string | null
}

export type ErrorReportsInfo = {
  enabled: boolean
  count: number
}

export type RendererError = { name?: string; message?: string; stack?: string }

export interface AuriReports {
  info(): Promise<ErrorReportsInfo>
  setEnabled(on: boolean): Promise<ErrorReportsInfo>
  copy(): Promise<void>
  error(error: RendererError): void
}

export interface AuriUpdates {
  info(): Promise<UpdateState>
  check(): Promise<UpdateState>
  install(): Promise<void>
  setChannel(channel: UpdateChannel): Promise<UpdateState>
  onChange(listener: (state: UpdateState) => void): () => void
}
