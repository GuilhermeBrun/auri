import { contextBridge, ipcRenderer } from 'electron'
import {
  DEFAULT_UI_PREFS,
  PREFS_ARG,
  type AuriApi,
  type AuriBackup,
  type AuriConnection,
  type BackupInfo,
  type AuriPrefs,
  type AuriReports,
  type AuriTransfer,
  type AuriUpdates,
  type AuriWhatsApp,
  type ConnectionInfo,
  type DataTopic,
  type IpcResult,
  type UpdateState
} from '../shared/api'
import type { AgendaNotice } from '../shared/agenda-notice'
import type { TextSize } from '../shared/aparencia'
import type { UiPrefs } from '../shared/schemas'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const agendaListeners = new Set<(inicio: string) => void>()
let pendingAgenda: string | null = null

ipcRenderer.on('agenda:open', (_event, inicio: string) => {
  if (agendaListeners.size === 0) pendingAgenda = inicio
  for (const listener of agendaListeners) listener(inicio)
})

const api: AuriApi = {
  patients: {
    list: (filter) => invoke('patients:list', filter),
    get: (id) => invoke('patients:get', id),
    create: (input) => invoke('patients:create', input),
    update: (id, input, expected) => invoke('patients:update', id, input, expected),
    setAtivo: (id, ativo) => invoke('patients:setAtivo', id, ativo)
  },
  appointments: {
    listRange: (de, ate) => invoke('appointments:listRange', de, ate),
    listByPatient: (patientId) => invoke('appointments:listByPatient', patientId),
    create: (input) => invoke('appointments:create', input),
    update: (id, input, expected, computador) =>
      invoke('appointments:update', id, input, expected, computador),
    remove: (id) => invoke('appointments:remove', id),
    move: (id, slot, expected, computador) =>
      invoke('appointments:move', id, slot, expected, computador),
    scheduleOnReserve: (reserveId, input) =>
      invoke('appointments:scheduleOnReserve', reserveId, input)
  },
  commitments: {
    listRange: (de, ate) => invoke('commitments:listRange', de, ate),
    create: (input) => invoke('commitments:create', input),
    update: (id, input, expected) => invoke('commitments:update', id, input, expected),
    remove: (id) => invoke('commitments:remove', id)
  },
  attendance: {
    sign: (appointmentId, input, computador) =>
      invoke('attendance:sign', appointmentId, input, computador),
    void: (signatureId, motivo, computador) =>
      invoke('attendance:void', signatureId, motivo, computador),
    listByPatient: (patientId) => invoke('attendance:listByPatient', patientId),
    reportPdf: (patientId, de, ate) => invoke('pdf:attendance', patientId, de, ate)
  },
  documents: {
    evolutionsPdf: (patientId, de, ate) => invoke('pdf:evolutions', patientId, de, ate),
    patientPdf: (patientId) => invoke('pdf:patient', patientId),
    anamnesePdf: (patientId) => invoke('pdf:anamnese', patientId)
  },
  clinic: {
    get: () => invoke('clinic:get'),
    save: (input, expected) => invoke('clinic:save', input, expected),
    chooseLogo: () => invoke('clinic:chooseLogo')
  },
  terms: {
    models: () => invoke('terms:models'),
    measureModel: (input) => invoke('terms:measureModel', input),
    saveModel: (id, input) => invoke('terms:saveModel', id, input),
    archiveModel: (id, arquivado) => invoke('terms:archiveModel', id, arquivado),
    listByPatient: (patientId) => invoke('terms:listByPatient', patientId),
    send: (patientId, input, computador) => invoke('terms:send', patientId, input, computador),
    link: (requestId) => invoke('terms:link', requestId),
    cancel: (requestId) => invoke('terms:cancel', requestId),
    check: (texto) => invoke('terms:check', texto),
    accept: (texto, computador) => invoke('terms:accept', texto, computador),
    openWhatsApp: (numero, texto) => invoke('terms:openWhatsApp', numero, texto),
    openPdf: (signedId) => invoke('pdf:term', signedId),
    takeIncoming: () => invoke('terms:takeIncoming'),
    onIncoming: (listener) => subscribe<void>('terms:incoming', listener)
  },
  confirmacoes: {
    lista: () => invoke('confirmacoes:lista'),
    enviar: (appointmentId, computador) => invoke('confirmacoes:enviar', appointmentId, computador),
    receber: (texto, computador) => invoke('confirmacoes:receber', texto, computador),
    aplicarOutra: (requestId, computador) =>
      invoke('confirmacoes:aplicarOutra', requestId, computador),
    avisos: () => invoke('confirmacoes:avisos'),
    dispensar: (requestId, tipo) => invoke('confirmacoes:dispensar', requestId, tipo),
    takeIncoming: () => invoke('confirmacoes:takeIncoming'),
    onIncoming: (listener) => subscribe<void>('confirmacoes:incoming', listener)
  },
  anamneses: {
    get: (patientId) => invoke('anamneses:get', patientId),
    save: (patientId, input, expected) => invoke('anamneses:save', patientId, input, expected)
  },
  tipos: {
    list: () => invoke('tipos:list'),
    save: (id, input) => invoke('tipos:save', id, input),
    usage: (id) => invoke('tipos:usage', id),
    remove: (id, destino) => invoke('tipos:remove', id, destino)
  },
  waitlist: {
    list: () => invoke('waitlist:list'),
    getByPatient: (patientId) => invoke('waitlist:getByPatient', patientId),
    add: (input) => invoke('waitlist:add', input),
    update: (id, input, expected) => invoke('waitlist:update', id, input, expected),
    close: (id, close) => invoke('waitlist:close', id, close)
  },
  encaixe: {
    sugerir: (input) => invoke('encaixe:sugerir', input),
    quemCabe: (vaga) => invoke('encaixe:quemCabe', vaga)
  },
  finance: {
    catalog: () => invoke('finance:catalog'),
    saveService: (id, input) => invoke('finance:saveService', id, input),
    archiveService: (id, arquivado) => invoke('finance:archiveService', id, arquivado),
    savePlan: (id, input) => invoke('finance:savePlan', id, input),
    archivePlan: (id, arquivado) => invoke('finance:archivePlan', id, arquivado),
    saveInsurer: (id, input) => invoke('finance:saveInsurer', id, input),
    archiveInsurer: (id, arquivado) => invoke('finance:archiveInsurer', id, arquivado),
    patient: (patientId) => invoke('finance:patient', patientId),
    setBilling: (patientId, input, expected, contratar) =>
      invoke('finance:setBilling', patientId, input, expected, contratar),
    renewPackage: (patientId, computador) => invoke('finance:renewPackage', patientId, computador),
    contractPackage: (patientId, input, computador) =>
      invoke('finance:contractPackage', patientId, input, computador),
    charge: (patientId, input, computador) =>
      invoke('finance:charge', patientId, input, computador),
    pay: (patientId, input, computador) => invoke('finance:pay', patientId, input, computador),
    launchSession: (appointmentId, computador, serviceId) =>
      invoke('finance:launchSession', appointmentId, computador, serviceId),
    chargeAbsence: (appointmentId, computador) =>
      invoke('finance:chargeAbsence', appointmentId, computador),
    void: (kind, id, motivo, computador) => invoke('finance:void', kind, id, motivo, computador),
    sessionStatus: (ids) => invoke('finance:sessionStatus', ids),
    overview: (de, ate) => invoke('finance:overview', de, ate)
  },
  onChanged: (listener) => subscribe<DataTopic[]>('data:changed', listener),
  onNotice: (listener) => subscribe<AgendaNotice>('agenda:notice', listener),
  onOpenAgenda: (listener) => {
    agendaListeners.add(listener)
    if (pendingAgenda !== null) {
      listener(pendingAgenda)
      pendingAgenda = null
    }
    return () => agendaListeners.delete(listener)
  }
}

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: unknown, value: T): void => listener(value)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.off(channel, wrapped)
}

const connection: AuriConnection = {
  info: () => invoke('connection:info'),
  onChange: (listener) => subscribe<ConnectionInfo>('connection:changed', listener),
  setRole: (role) => invoke('connection:setRole', role),
  setName: (name) => invoke('connection:setName', name),
  setSharing: (on) => invoke('connection:setSharing', on),
  setKeepRunning: (on) => invoke('connection:setKeepRunning', on),
  setOpenAtLogin: (on) => invoke('connection:setOpenAtLogin', on),
  setRemoteAccess: (on) => invoke('connection:setRemoteAccess', on),
  setNotices: (on) => invoke('connection:setNotices', on),
  testRemote: () => invoke('connection:testRemote'),
  createCode: () => invoke('connection:createCode'),
  cancelCode: () => invoke('connection:cancelCode'),
  removeDevice: (key) => invoke('connection:removeDevice', key),
  discover: () => invoke('connection:discover'),
  pair: (address, code) => invoke('connection:pair', address, code),
  forget: () => invoke('connection:forget'),
  retry: () => invoke('connection:retry')
}

const backup: AuriBackup = {
  info: () => invoke('backup:info'),
  onChange: (listener) => subscribe<BackupInfo>('backup:changed', listener),
  providers: () => invoke('backup:providers'),
  check: () => invoke('backup:check'),
  chooseFolder: () => invoke('backup:chooseFolder'),
  setup: (destination, password, replace) => invoke('backup:setup', destination, password, replace),
  setDestination: (destination) => invoke('backup:setDestination', destination),
  setFrequency: (frequency, time) => invoke('backup:setFrequency', frequency, time),
  runNow: () => invoke('backup:runNow'),
  openFolder: () => invoke('backup:openFolder'),
  changePassword: (current, next) => invoke('backup:changePassword', current, next),
  resetPassword: (code, next) => invoke('backup:resetPassword', code, next),
  newRecoveryCode: (password) => invoke('backup:newRecoveryCode', password),
  printRecoveryCode: (code) => invoke('backup:printRecoveryCode', code),
  disable: () => invoke('backup:disable'),
  list: () => invoke('backup:list'),
  pickFile: () => invoke('backup:pickFile'),
  restore: (file, secret) => invoke('backup:restore', file, secret),
  undoRestore: () => invoke('backup:undoRestore'),
  dismissWelcome: () => invoke('backup:dismissWelcome'),
  install: (id) => invoke('backup:install', id),
  onInstallProgress: (listener) => subscribe('backup:installProgress', listener),
  openProvider: (id) => invoke('backup:openProvider', id)
}

const prefsArg = process.argv.find((arg) => arg.startsWith(PREFS_ARG))
const prefs: AuriPrefs = {
  initial: prefsArg ? JSON.parse(prefsArg.slice(PREFS_ARG.length)) : DEFAULT_UI_PREFS,
  save: (value) => ipcRenderer.send('prefs:save', value),
  onChange: (listener) => subscribe<UiPrefs>('prefs:changed', listener),
  enableReception: (password) => invoke('reception:enable', password),
  disableReception: (secret) => invoke('reception:disable', secret),
  onFit: (listener) => subscribe<TextSize>('prefs:fit', listener)
}

const transfer: AuriTransfer = {
  exportSettings: () => invoke('transfer:export'),
  pickSettings: () => invoke('transfer:pick'),
  applySettings: (token) => invoke('transfer:apply', token)
}

const updates: AuriUpdates = {
  info: () => invoke('updates:info'),
  check: () => invoke('updates:check'),
  install: () => invoke('updates:install'),
  setChannel: (channel) => invoke('updates:setChannel', channel),
  onChange: (listener) => subscribe<UpdateState>('updates:changed', listener)
}

const reports: AuriReports = {
  info: () => invoke('reports:info'),
  setEnabled: (on) => invoke('reports:setEnabled', on),
  copy: () => invoke('reports:copy'),
  error: (error) => ipcRenderer.send('reports:error', error)
}

const whatsapp: AuriWhatsApp = {
  show: (bounds) => invoke('whatsapp:show', bounds),
  hide: () => invoke('whatsapp:hide'),
  unread: () => invoke('whatsapp:unread'),
  onUnread: (listener) => subscribe<number>('whatsapp:unread', listener),
  onOpen: (listener) => subscribe<void>('whatsapp:open', listener)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('prefs', prefs)
contextBridge.exposeInMainWorld('connection', connection)
contextBridge.exposeInMainWorld('backup', backup)
contextBridge.exposeInMainWorld('transfer', transfer)
contextBridge.exposeInMainWorld('updates', updates)
contextBridge.exposeInMainWorld('reports', reports)
contextBridge.exposeInMainWorld('whatsapp', whatsapp)
contextBridge.exposeInMainWorld('platform', process.platform)
