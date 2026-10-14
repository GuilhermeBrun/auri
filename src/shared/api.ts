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
  /** Avisa quando as preferências mudam fora desta janela (configurações importadas). */
  onChange(listener: (prefs: UiPrefs) => void): () => void
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

/**
 * Se o computador que guarda os dados pode ser alcançado de fora da clínica (pela internet, sem
 * abrir porta no roteador).
 * - `starting`: verificando.
 * - `open`: o roteador aceita conexões de fora.
 * - `likely`: o roteador bloqueia, mas de um jeito que dá para atravessar na maioria das redes.
 * - `restricted`: o roteador troca a porta a cada conexão; de fora, só de redes bem abertas.
 * - `offline`: sem internet agora (dentro da clínica continua funcionando).
 */
export type RemoteReach = 'starting' | 'open' | 'likely' | 'restricted' | 'offline'

/** Por onde este computador está conectado ao outro. */
export type LinkVia = 'local' | 'internet'

/** Resultado de "Testar acesso pela internet". */
export type RemoteProbe = { ok: true; ms: number } | { ok: false; error: string }

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
  /** Aceitar conexões de fora da clínica (pela internet). */
  remoteAccess: boolean
  /** null quando não compartilha ou com o acesso de fora desligado. */
  remoteReach: RemoteReach | null
  /** Endereços deste computador na rede (para digitar no outro, se a busca não achar). */
  addresses: string[]
  devices: PairedDevice[]
  // Papel cliente
  server: { name: string; publicKey: string; address: string | null } | null
  /** Por onde está conectado agora (null quando não está). */
  via: LinkVia | null
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
  setRemoteAccess(on: boolean): Promise<ConnectionInfo>
  /** Conecta ao outro computador só pela internet, para saber se funciona de fora da clínica. */
  testRemote(): Promise<RemoteProbe>
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

/** Quando a cópia de segurança sai sozinha. */
export type BackupFrequency = 'daily' | 'change' | 'manual'

/** Nuvens que o Auri reconhece pela pasta que o app delas cria no computador. */
export type CloudProviderId = 'google' | 'onedrive' | 'icloud'

/** Onde as cópias ficam: uma das nuvens ou qualquer outra pasta (pendrive, HD externo). */
export type BackupDestination = { kind: CloudProviderId | 'folder'; folder: string }

/**
 * Situação de uma nuvem neste computador.
 * - `ready`: a pasta existe; dá para usar.
 * - `signed-out`: o app está instalado, mas falta entrar na conta (a pasta não apareceu).
 * - `closed`: o app está instalado e com conta, mas fechado: a pasta existe e não responde.
 * - `off`: iCloud Drive desligado nos Ajustes do Sistema.
 * - `denied`: o macOS não deixou o Auri abrir a pasta (Privacidade e Segurança).
 * - `not-installed`: o app da nuvem não está instalado.
 */
export type CloudState = 'ready' | 'signed-out' | 'closed' | 'off' | 'denied' | 'not-installed'

export type CloudProvider = {
  id: CloudProviderId
  name: string
  state: CloudState
  /** Pasta da nuvem (a raiz do "Meu Drive", por exemplo), quando `ready`. */
  folder: string | null
}

/** Andamento de "Instalar" (baixar o instalador oficial e abrir). */
export type InstallProgress = {
  id: CloudProviderId
  stage: 'downloading' | 'opening' | 'waiting' | 'error'
  /** 0 a 1, enquanto baixa (null se o tamanho não veio). */
  progress: number | null
  error?: string
}

export type BackupInfo = {
  /** Este computador guarda os dados: só ele faz cópias. */
  available: boolean
  /** Já tem pasta e senha. */
  configured: boolean
  destination: BackupDestination | null
  /** A pasta escolhida não está acessível agora (nuvem desligada, pendrive fora). */
  folderMissing: boolean
  frequency: BackupFrequency
  /** "HH:mm" da cópia diária. */
  dailyTime: string
  /** Uma cópia, troca de senha ou restauração em andamento. */
  running: boolean
  lastSuccessAt: string | null
  lastError: { at: string; message: string } | null
  /** Mais de 3 dias sem cópia (ou nenhuma) com a cópia ligada. */
  stale: boolean
  /** Dá para desfazer a última restauração. */
  undo: { at: string } | null
  /** Mostrar "Já usa o Auri?" (primeira abertura com o banco vazio). */
  welcome: boolean
  /** Nuvem trazida por configurações importadas, sugerida no assistente. */
  suggested: BackupDestination['kind'] | null
  /** A nuvem escolhida deixou de funcionar; null quando está tudo certo (ou é uma pasta comum). */
  destinationProblem: DestinationProblem | null
}

/**
 * A nuvem escolhida não está pronta: desinstalada, fechada, fora da conta, desligada, bloqueada,
 * ou pronta mas em outra conta (`state: 'ready'` com outra `folder`).
 */
export type DestinationProblem = {
  state: CloudState
  /** Pasta da nuvem agora (a da outra conta, quando `ready`). */
  folder: string | null
  /** "O Google Drive não está mais instalado neste computador." */
  message: string
}

/** Uma cópia encontrada (na pasta escolhida, numa nuvem ou num arquivo escolhido). */
export type BackupEntry = {
  file: string
  name: string
  createdAt: string
  counts: { patients: number; appointments: number }
  /** Onde está: "Google Drive", "Pasta escolhida"… */
  location: string
  /** Feita com a chave deste computador: abre sem pedir senha. */
  own: boolean
}

/** Como abrir uma cópia de outro computador. */
export type BackupSecret = { password: string } | { recoveryCode: string }

/** Configurações / Cópia de segurança. Exposto em window.backup pelo preload. */
export interface AuriBackup {
  info(): Promise<BackupInfo>
  /** Avisa a cada mudança (cópia feita, falha, troca de papel). Devolve a função que cancela. */
  onChange(listener: (info: BackupInfo) => void): () => void
  /** Google Drive, OneDrive e iCloud (só no Mac) e a situação de cada um. */
  providers(): Promise<CloudProvider[]>
  /** Janela do sistema para escolher uma pasta qualquer. null se cancelar. */
  chooseFolder(): Promise<string | null>
  /** Liga a cópia: guarda o destino e cria a chave presa à senha. Devolve o código de recuperação. */
  setup(destination: BackupDestination, password: string): Promise<{ recoveryCode: string }>
  setDestination(destination: BackupDestination): Promise<BackupInfo>
  setFrequency(frequency: BackupFrequency, dailyTime: string): Promise<BackupInfo>
  runNow(): Promise<BackupInfo>
  openFolder(): Promise<void>
  changePassword(current: string, next: string): Promise<BackupInfo>
  /** "Esqueci a senha": código de recuperação + senha nova. */
  resetPassword(recoveryCode: string, next: string): Promise<BackupInfo>
  /** Gera outro código (pede a senha); o antigo deixa de valer. */
  newRecoveryCode(password: string): Promise<{ recoveryCode: string }>
  printRecoveryCode(code: string): Promise<void>
  /** Desliga as cópias automáticas e esquece a senha. As cópias já feitas ficam na pasta. */
  disable(): Promise<BackupInfo>
  /** Cópias na pasta escolhida e nas nuvens deste computador, da mais nova para a mais antiga. */
  list(): Promise<BackupEntry[]>
  /** Janela do sistema para escolher um arquivo de cópia. null se cancelar. */
  pickFile(): Promise<BackupEntry | null>
  /** Troca os dados pelos da cópia. `secret` só é preciso para cópias de outro computador. */
  restore(file: string, secret?: BackupSecret): Promise<BackupInfo>
  undoRestore(): Promise<BackupInfo>
  dismissWelcome(): Promise<BackupInfo>
  /** Baixa o instalador oficial da nuvem e o abre. */
  install(id: CloudProviderId): Promise<void>
  onInstallProgress(listener: (progress: InstallProgress) => void): () => void
  /** Confere agora se a nuvem escolhida continua pronta. */
  check(): Promise<BackupInfo>
  /** Abre o app da nuvem (para entrar na conta) ou os Ajustes do iCloud. */
  openProvider(id: CloudProviderId): Promise<void>
}

/** Uma configuração que muda ao importar: "Tema: Sistema → Escuro". */
export type SettingsChange = { label: string; from: string; to: string }

/** Configurações lidas de um arquivo, prontas para confirmar. */
export type SettingsPreview = {
  /** Identifica o arquivo lido (o main guarda o conteúdo até aplicar). */
  token: string
  name: string
  exportedAt: string
  changes: SettingsChange[]
}

/** Configurações / Importar e exportar. Exposto em window.transfer pelo preload. */
export interface AuriTransfer {
  /** Janela do sistema para salvar o arquivo. Devolve o caminho, ou null se cancelar. */
  exportSettings(): Promise<string | null>
  /** Janela do sistema para escolher o arquivo; devolve o que vai mudar. null se cancelar. */
  pickSettings(): Promise<SettingsPreview | null>
  /** Aplica as configurações lidas por `pickSettings`. */
  applySettings(token: string): Promise<void>
}
