import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { rm } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type {
  BackupDestination,
  BackupEntry,
  BackupFrequency,
  BackupInfo,
  BackupSecret,
  CloudProvider,
  CloudProviderId,
  CloudState,
  DestinationProblem,
  InstallProgress
} from '../shared/api'
import { createKeyring, keyFromSecret, readHeaderFromFile, type Keyring } from './backup/archive'
import {
  backupFolder,
  createBackup,
  describeBackup,
  extractBackup,
  listBackups,
  reencryptBackups,
  type BackupEntry as FileEntry
} from './backup/backup'
import {
  newRecoveryCode,
  normalizeRecoveryCode,
  seal,
  unseal,
  WrongSecretError
} from './backup/crypto'
import { installProvider, openProvider } from './backup/installer'
import { isBackupDue, isStale } from './backup/scheduler'
import { createBackupStore, type BackupStore } from './backup/store'
import type { Connection } from './connection'

/** De quanto em quanto tempo confere se está na hora de uma cópia automática. */
const TICK_MS = 60_000
/** Primeira conferência depois de abrir: deixa a janela abrir antes. */
const FIRST_TICK_MS = 10_000

const DESTINATION_LABEL: Record<BackupDestination['kind'], string> = {
  google: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive',
  folder: 'Pasta escolhida'
}

export type BackupService = {
  info(): BackupInfo
  /** Avisa as telas de novo (ex.: o papel do computador mudou). */
  refresh(): void
  /** Uma gravação deu certo nos dados deste computador. */
  dataWritten(): void
  setup(destination: BackupDestination, password: string): Promise<{ recoveryCode: string }>
  setDestination(destination: BackupDestination): Promise<BackupInfo>
  setFrequency(frequency: BackupFrequency, dailyTime: string): Promise<BackupInfo>
  runNow(): Promise<BackupInfo>
  openFolder(): Promise<void>
  chooseFolder(): Promise<string | null>
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
  providers(): Promise<CloudProvider[]>
  /** Confere agora se a nuvem escolhida continua pronta (a aba chama enquanto há problema). */
  check(): Promise<BackupInfo>
  install(id: CloudProviderId): Promise<void>
  openProvider(id: CloudProviderId): Promise<void>
  /** Pasta das cópias ou da nuvem escolhida, para abrir a janela de salvar configurações nela. */
  preferredFolder(): string | null
  /** Nuvem sugerida no assistente (vinda de configurações importadas). */
  suggest(kind: BackupDestination['kind'] | null): void
  close(): void
}

/**
 * Cópia de segurança dos dados (ver docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md).
 * Só no papel servidor, que é quem tem o banco. A chave das cópias fica no cofre do sistema, então
 * as cópias automáticas não pedem senha; a senha e o código de recuperação só servem para abrir
 * as cópias em outro computador e para trocar a própria senha.
 */
export function createBackupService(options: {
  userData: string
  connection: Connection
  onInfoChanged: (info: BackupInfo) => void
  /** Nuvens deste computador (para listar cópias nelas e reconhecer a pasta de uma cópia). */
  providers?: () => Promise<CloudProvider[]>
  /** Andamento de "Instalar" (baixando, abrindo o instalador…). */
  onInstallProgress?: (progress: InstallProgress) => void
}): BackupService {
  const store = createBackupStore(join(options.userData, 'copias.json'))
  const tmpDir = join(app.getPath('temp'), 'auri-copias')
  const undoFile = join(options.userData, 'Restauração', 'antes-de-restaurar.db')
  /** Arquivos que as telas podem pedir para restaurar: só os que o main listou ou o usuário escolheu. */
  const known = new Set<string>()
  let running = 0
  /** A nuvem escolhida deixou de funcionar (desinstalada, fechada, saiu da conta…); null se ok. */
  let problem: DestinationProblem | null = null
  let queue: Promise<unknown> = Promise.resolve()

  // Chave -------------------------------------------------------------------------------------

  function keyring(): Keyring | null {
    const saved = store.get().keyring
    if (!saved) return null
    const encoded = saved.encrypted
      ? safeStorage.decryptString(Buffer.from(saved.key, 'base64'))
      : saved.key
    return {
      key: Buffer.from(encoded, 'base64'),
      keyId: saved.keyId,
      password: saved.password,
      recovery: saved.recovery
    }
  }

  function saveKeyring(next: Keyring): void {
    const encoded = next.key.toString('base64')
    const encrypted = safeStorage.isEncryptionAvailable()
    store.update({
      keyring: {
        keyId: next.keyId,
        key: encrypted ? safeStorage.encryptString(encoded).toString('base64') : encoded,
        encrypted,
        password: next.password,
        recovery: next.recovery
      }
    })
  }

  // Estado ------------------------------------------------------------------------------------

  const available = (): boolean => options.connection.info().role === 'server'
  const configured = (s: BackupStore = store.get()): boolean => !!(s.destination && s.keyring)

  /** Banco sem nenhum paciente nem sessão: o Auri acabou de ser instalado. */
  function emptyDatabase(): boolean {
    const db = options.connection.database()
    if (!db) return false
    const row = db
      .prepare('SELECT (SELECT count(*) FROM patients) + (SELECT count(*) FROM appointments) AS n')
      .get() as { n: number }
    return row.n === 0
  }

  function info(): BackupInfo {
    const s = store.get()
    const on = configured(s)
    return {
      available: available(),
      configured: on,
      destination: s.destination,
      folderMissing: !!s.destination && !existsSync(s.destination.folder),
      frequency: s.frequency,
      dailyTime: s.dailyTime,
      running: running > 0,
      lastSuccessAt: s.lastSuccessAt,
      lastError: s.lastError,
      stale: on && isStale(s.lastSuccessAt, new Date()),
      undo: s.undo ? { at: s.undo.at } : null,
      welcome: !s.welcomeDone && !on && available() && emptyDatabase(),
      suggested: s.suggested,
      destinationProblem: on ? problem : null
    }
  }

  const changed = (): void => options.onInfoChanged(info())

  /** Uma operação pesada por vez (cópia, troca de senha, restauração), na ordem em que chegam. */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      running++
      changed()
      try {
        return await task()
      } finally {
        running--
        changed()
      }
    })
    queue = run.catch(() => undefined)
    return run
  }

  function requireServer(): void {
    if (!available()) {
      throw new Error('As cópias são feitas no computador que guarda os dados.')
    }
  }

  function requireKeyring(): Keyring {
    const current = keyring()
    if (!current) throw new Error('A cópia de segurança não está ligada.')
    return current
  }

  function validatePassword(password: string): void {
    if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.')
  }

  // Cópia -------------------------------------------------------------------------------------

  /** O que dizer quando a nuvem escolhida não está pronta. */
  function problemMessage(kind: CloudProviderId, state: CloudState): string {
    const name = DESTINATION_LABEL[kind]
    switch (state) {
      case 'not-installed':
        return `O ${name} não está mais instalado neste computador.`
      case 'signed-out':
        return `O ${name} saiu da conta.`
      case 'closed':
        return `O ${name} está fechado.`
      case 'off':
        return 'O iCloud Drive foi desligado neste Mac.'
      case 'denied':
        return `O macOS bloqueou o acesso do Auri ao ${name}.`
      case 'ready':
        return `O ${name} agora está em outra conta.`
    }
  }

  /**
   * Confere se a nuvem escolhida continua pronta e na mesma pasta (a de uma conta). Avisa as telas
   * quando muda; quando volta a funcionar, já faz a cópia que ficou parada.
   */
  async function checkDestination(): Promise<void> {
    const destination = store.get().destination
    let next: DestinationProblem | null = null
    if (destination && destination.kind !== 'folder' && configured()) {
      const cloud = ((await options.providers?.()) ?? []).find((c) => c.id === destination.kind)
      if (
        cloud &&
        !(cloud.state === 'ready' && cloud.folder && sameName(cloud.folder, destination.folder))
      ) {
        next = {
          state: cloud.state,
          folder: cloud.folder,
          message: problemMessage(destination.kind, cloud.state)
        }
      }
    }
    const recovered = problem !== null && next === null
    if (JSON.stringify(next) === JSON.stringify(problem)) return
    problem = next
    console.log(`[cópia] nuvem: ${next ? next.state : 'pronta'}`)
    changed()
    if (recovered) void backup()
  }

  /** Mensagem para a tela quando a cópia falha. */
  function failureMessage(error: unknown, destination: BackupDestination): string {
    if (problem) return `${problem.message} As cópias estão paradas.`
    if (!existsSync(destination.folder)) {
      return destination.kind === 'folder'
        ? 'A pasta escolhida não está disponível. Confira se o pendrive ou HD está conectado.'
        : `A pasta do ${DESTINATION_LABEL[destination.kind]} não está disponível. Confira se ele está aberto e conectado à conta.`
    }
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      return 'Sem permissão para gravar na pasta da cópia.'
    }
    if (code === 'ENOSPC') return 'Sem espaço na pasta da cópia.'
    // a pasta da nuvem existe, mas o app dela está fechado ou travado
    if (code === 'ETIMEDOUT' && destination.kind !== 'folder') {
      return `O ${DESTINATION_LABEL[destination.kind]} não respondeu. Confira se ele está aberto.`
    }
    return `Não foi possível fazer a cópia: ${(error as Error).message}`
  }

  function backup(): Promise<void> {
    return exclusive(async () => {
      const s = store.get()
      const db = options.connection.database()
      const current = keyring()
      if (!s.destination || !current || !db) return
      const startedAt = new Date()
      try {
        const entry = await createBackup({
          db,
          folder: backupFolder(s.destination.folder),
          keyring: current,
          tmpDir,
          now: startedAt
        })
        store.update({
          lastSuccessAt: startedAt.toISOString(),
          lastFile: entry.file,
          lastError: null
        })
        console.log('[cópia] feita')
      } catch (error) {
        const message = failureMessage(error, s.destination)
        store.update({ lastError: { at: new Date().toISOString(), message } })
        console.error(`[cópia] falhou: ${(error as Error).name}`)
      }
    })
  }

  async function tick(): Promise<void> {
    const s = store.get()
    if (!available() || !configured(s) || running > 0) return
    await checkDestination()
    // com a nuvem fora do ar, tentar só repetiria a falha: a aba já mostra o que resolver
    if (problem) return
    const due = isBackupDue(
      {
        frequency: s.frequency,
        dailyTime: s.dailyTime,
        lastSuccessAt: s.lastSuccessAt,
        lastChangeAt: s.lastChangeAt,
        lastErrorAt: s.lastError?.at ?? null
      },
      new Date()
    )
    if (due) void backup()
  }

  const safeTick = (): void => {
    tick().catch((error) => console.error(`[cópia] verificação: ${(error as Error).message}`))
  }

  const firstTick = setTimeout(safeTick, FIRST_TICK_MS)
  const interval = setInterval(safeTick, TICK_MS)

  // Restauração -------------------------------------------------------------------------------

  async function toEntry(file: FileEntry, location: string): Promise<BackupEntry> {
    known.add(file.file)
    return {
      file: file.file,
      name: file.name,
      createdAt: file.createdAt,
      counts: file.counts,
      location,
      own: file.keyId === store.get().keyring?.keyId
    }
  }

  const sameName = (a: string, b: string): boolean => a.normalize('NFC') === b.normalize('NFC')

  /**
   * Restaurou num computador sem cópia ligada, de uma cópia que estava na pasta de cópias de uma
   * nuvem: continua copiando para lá, com a mesma senha, sem pedir nada.
   */
  async function adopt(file: string, key: Buffer): Promise<void> {
    if (configured()) return
    const header = await readHeaderFromFile(file)
    const adopted: Keyring = {
      key,
      keyId: header.keyId,
      password: header.keys.password,
      recovery: header.keys.recovery
    }
    const dir = dirname(file)
    let destination: BackupDestination | null = null
    if (sameName(basename(dir), 'Cópias') && sameName(basename(dirname(dir)), 'Auri')) {
      const root = dirname(dirname(dir))
      const clouds = (await options.providers?.()) ?? []
      const cloud = clouds.find((c) => c.folder && sameName(c.folder, root))
      destination = { kind: cloud?.id ?? 'folder', folder: root }
    }
    saveKeyring(adopted)
    if (destination) store.update({ destination, lastSuccessAt: header.createdAt })
  }

  /** Troca o banco por `source`, guardando antes o atual para "Desfazer restauração". */
  async function swapDatabase(source: string, keepUndo: boolean): Promise<void> {
    const db = options.connection.database()
    if (!db) throw new Error('As cópias são feitas no computador que guarda os dados.')
    if (keepUndo) {
      mkdirSync(dirname(undoFile), { recursive: true })
      await db.backup(undoFile)
    }
    options.connection.replaceDatabase(source)
  }

  // Senha -------------------------------------------------------------------------------------

  /** Grava o novo `keyring` e regrava as cópias da pasta com ele. */
  async function rekey(previous: Keyring, next: Keyring): Promise<void> {
    const destination = store.get().destination
    if (destination && existsSync(destination.folder)) {
      await reencryptBackups(backupFolder(destination.folder), previous, next)
    }
    saveKeyring(next)
  }

  async function checkPassword(current: Keyring, password: string): Promise<void> {
    const key = await unseal(current.password, password, 'Senha atual incorreta.')
    if (!key.equals(current.key)) throw new WrongSecretError('Senha atual incorreta.')
  }

  /**
   * Onde as janelas de escolher abrem: na pasta das cópias, se já houver. Sem `defaultPath` o
   * Electron (desde o 43) abre sempre em Downloads.
   */
  function startFolder(): string {
    const destination = store.get().destination
    if (!destination || !existsSync(destination.folder)) return app.getPath('home')
    const folder = backupFolder(destination.folder)
    return existsSync(folder) ? folder : destination.folder
  }

  return {
    info,
    refresh: changed,

    dataWritten(): void {
      // só a frequência "a cada alteração" precisa saber; evita gravar o JSON a cada clique
      if (store.get().frequency !== 'change') return
      store.update({ lastChangeAt: new Date().toISOString() })
    },

    async setup(destination, password) {
      requireServer()
      validatePassword(password)
      const recoveryCode = newRecoveryCode()
      const next = await createKeyring(password, recoveryCode)
      saveKeyring(next)
      store.update({
        destination,
        lastSuccessAt: null,
        lastFile: null,
        lastError: null,
        welcomeDone: true,
        suggested: null
      })
      // a primeira cópia sai enquanto o código aparece na tela
      void backup()
      return { recoveryCode }
    },

    async setDestination(destination) {
      requireServer()
      store.update({ destination, lastError: null })
      problem = null
      changed()
      // pasta nova começa vazia: a primeira cópia vai já
      if (configured()) void backup()
      return info()
    },

    async setFrequency(frequency, dailyTime) {
      store.update({ frequency, dailyTime })
      changed()
      return info()
    },

    async runNow() {
      requireServer()
      requireKeyring()
      await backup()
      const error = store.get().lastError
      // a falha aparece na aba; aqui ela volta para o botão também
      if (error && error.at > (store.get().lastSuccessAt ?? '')) throw new Error(error.message)
      return info()
    },

    async openFolder() {
      const destination = store.get().destination
      if (!destination) return
      const folder = backupFolder(destination.folder)
      if (existsSync(destination.folder)) mkdirSync(folder, { recursive: true })
      const error = await shell.openPath(existsSync(folder) ? folder : destination.folder)
      if (error) throw new Error('Não foi possível abrir a pasta.')
    },

    async chooseFolder() {
      const window = BrowserWindow.getFocusedWindow()
      const options = {
        title: 'Escolher pasta para as cópias',
        buttonLabel: 'Escolher',
        defaultPath: startFolder(),
        properties: ['openDirectory', 'createDirectory'] as Array<
          'openDirectory' | 'createDirectory'
        >
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    changePassword(current, next) {
      return exclusive(async () => {
        const previous = requireKeyring()
        validatePassword(next)
        await checkPassword(previous, current)
        // a chave continua; muda só o envelope da senha (o do código segue valendo)
        await rekey(previous, { ...previous, password: await seal(previous.key, next) })
        return info()
      })
    },

    resetPassword(recoveryCode, next) {
      return exclusive(async () => {
        const previous = requireKeyring()
        validatePassword(next)
        const key = await unseal(
          previous.recovery,
          normalizeRecoveryCode(recoveryCode),
          'Código de recuperação incorreto.'
        )
        if (!key.equals(previous.key)) {
          throw new WrongSecretError('Código de recuperação incorreto.')
        }
        await rekey(previous, { ...previous, password: await seal(previous.key, next) })
        return info()
      })
    },

    newRecoveryCode(password) {
      return exclusive(async () => {
        const previous = requireKeyring()
        await checkPassword(previous, password)
        // chave nova: quem tinha o código antigo não abre mais nenhuma cópia da pasta
        const recoveryCode = newRecoveryCode()
        await rekey(previous, await createKeyring(password, recoveryCode))
        return { recoveryCode }
      })
    },

    async printRecoveryCode(code) {
      const clean = normalizeRecoveryCode(code)
        .replace(/(.{4})(?=.)/g, '$1-')
        .slice(0, 40)
      const date = new Date().toLocaleDateString('pt-BR')
      const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Código de recuperação do Auri</title>
<body style="font-family:-apple-system,'Segoe UI',sans-serif;padding:48px;color:#111">
<h1 style="font-size:20px;margin:0">Código de recuperação do Auri</h1>
<p style="font-size:13px;color:#555;margin:8px 0 32px">Gerado em ${date}. Guarde junto aos documentos da clínica.</p>
<p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;letter-spacing:2px;margin:0 0 32px">${clean}</p>
<p style="font-size:13px;line-height:1.5;max-width:520px">Com este código dá para abrir as cópias de segurança dos pacientes e da agenda num computador novo e criar outra senha, se a senha for esquecida. Quem tiver este papel e acesso à nuvem consegue ler as cópias: guarde em lugar seguro.</p>
</body></html>`
      const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
      try {
        await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        await new Promise<void>((resolve, reject) =>
          window.webContents.print({}, (ok, reason) =>
            ok || reason === 'cancelled'
              ? resolve()
              : reject(new Error('Não foi possível imprimir.'))
          )
        )
      } finally {
        window.destroy()
      }
    },

    async disable() {
      await queue
      store.update({
        destination: null,
        keyring: null,
        lastSuccessAt: null,
        lastFile: null,
        lastError: null,
        lastChangeAt: null
      })
      problem = null
      changed()
      return info()
    },

    async list() {
      const folders = new Map<string, string>()
      const destination = store.get().destination
      if (destination) {
        folders.set(backupFolder(destination.folder), DESTINATION_LABEL[destination.kind])
      }
      for (const cloud of (await options.providers?.()) ?? []) {
        if (cloud.state !== 'ready' || !cloud.folder) continue
        const folder = backupFolder(cloud.folder)
        if (!folders.has(folder)) folders.set(folder, cloud.name)
      }
      const lists = await Promise.all(
        [...folders].map(async ([folder, location]) =>
          Promise.all((await listBackups(folder)).map((entry) => toEntry(entry, location)))
        )
      )
      return lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async pickFile() {
      const window = BrowserWindow.getFocusedWindow()
      const options = {
        title: 'Escolher uma cópia de segurança',
        buttonLabel: 'Escolher',
        defaultPath: startFolder(),
        properties: ['openFile'] as Array<'openFile'>,
        filters: [{ name: 'Cópia de segurança do Auri', extensions: ['auribackup'] }]
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      const file = result.canceled ? undefined : result.filePaths[0]
      if (!file) return null
      const entry = await describeBackup(file)
      if (!entry) throw new Error('Este arquivo não é uma cópia de segurança do Auri.')
      return toEntry(entry, 'Arquivo escolhido')
    },

    restore(file, secret) {
      return exclusive(async () => {
        requireServer()
        if (!known.has(file)) throw new Error('Escolha a cópia de novo.')
        const header = await readHeaderFromFile(file)
        const own = keyring()
        const key =
          own && own.keyId === header.keyId
            ? own.key
            : secret
              ? await keyFromSecret(header, secret)
              : null
        if (!key) throw new WrongSecretError('Digite a senha da cópia.')
        mkdirSync(tmpDir, { recursive: true })
        const extracted = join(tmpDir, `restaurar-${Date.now()}.db`)
        try {
          await extractBackup(file, key, extracted)
          await swapDatabase(extracted, true)
        } finally {
          await rm(extracted, { force: true })
        }
        store.update({ undo: { file: undoFile, at: new Date().toISOString() }, welcomeDone: true })
        await adopt(file, key)
        console.log('[cópia] restaurada')
        return info()
      })
    },

    undoRestore() {
      return exclusive(async () => {
        const undo = store.get().undo
        if (!undo || !existsSync(undo.file)) {
          store.update({ undo: null })
          throw new Error('Não há restauração para desfazer.')
        }
        await swapDatabase(undo.file, false)
        await rm(undo.file, { force: true })
        store.update({ undo: null })
        return info()
      })
    },

    async dismissWelcome() {
      store.update({ welcomeDone: true })
      changed()
      return info()
    },

    providers: async () => (await options.providers?.()) ?? [],

    async check() {
      await checkDestination()
      return info()
    },

    install: (id) => installProvider(id, (progress) => options.onInstallProgress?.(progress)),

    async openProvider(id) {
      const provider = ((await options.providers?.()) ?? []).find((p) => p.id === id)
      await openProvider(id, provider?.state === 'denied')
    },

    preferredFolder() {
      const destination = store.get().destination
      if (!destination || !existsSync(destination.folder)) return null
      return join(destination.folder, 'Auri')
    },

    suggest(kind) {
      store.update({ suggested: kind })
      changed()
    },

    close() {
      clearTimeout(firstTick)
      clearInterval(interval)
    }
  }
}
