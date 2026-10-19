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
  type ConnectionInfo,
  type DataTopic,
  type IpcResult,
  type UpdateState
} from '../shared/api'
import type { UiPrefs } from '../shared/schemas'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

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
    update: (id, input, expected) => invoke('appointments:update', id, input, expected),
    remove: (id) => invoke('appointments:remove', id)
  },
  attendance: {
    sign: (appointmentId, input, computador) =>
      invoke('attendance:sign', appointmentId, input, computador),
    void: (signatureId, motivo, computador) =>
      invoke('attendance:void', signatureId, motivo, computador),
    listByPatient: (patientId) => invoke('attendance:listByPatient', patientId),
    reportPdf: (patientId, de, ate) => invoke('pdf:attendance', patientId, de, ate)
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
  anamneses: {
    get: (patientId) => invoke('anamneses:get', patientId),
    save: (patientId, input, expected) => invoke('anamneses:save', patientId, input, expected)
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
    setBilling: (patientId, input, expected) =>
      invoke('finance:setBilling', patientId, input, expected),
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
  onChanged: (listener) => subscribe<DataTopic[]>('data:changed', listener)
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
  setup: (destination, password) => invoke('backup:setup', destination, password),
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
  onChange: (listener) => subscribe<UiPrefs>('prefs:changed', listener)
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

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('prefs', prefs)
contextBridge.exposeInMainWorld('connection', connection)
contextBridge.exposeInMainWorld('backup', backup)
contextBridge.exposeInMainWorld('transfer', transfer)
contextBridge.exposeInMainWorld('updates', updates)
contextBridge.exposeInMainWorld('reports', reports)
contextBridge.exposeInMainWorld('platform', process.platform)
