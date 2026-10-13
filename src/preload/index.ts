import { contextBridge, ipcRenderer } from 'electron'
import {
  DEFAULT_UI_PREFS,
  PREFS_ARG,
  type AuriApi,
  type AuriConnection,
  type AuriPrefs,
  type ConnectionInfo,
  type DataTopic,
  type IpcResult
} from '../shared/api'

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
    create: (input) => invoke('appointments:create', input),
    update: (id, input, expected) => invoke('appointments:update', id, input, expected),
    remove: (id) => invoke('appointments:remove', id)
  },
  onChanged: (listener) => subscribe<DataTopic[]>('data:changed', listener)
}

/** Avisos do main para a janela. Devolve a função que cancela. */
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
  createCode: () => invoke('connection:createCode'),
  cancelCode: () => invoke('connection:cancelCode'),
  removeDevice: (key) => invoke('connection:removeDevice', key),
  discover: () => invoke('connection:discover'),
  pair: (address, code) => invoke('connection:pair', address, code),
  forget: () => invoke('connection:forget'),
  retry: () => invoke('connection:retry')
}

// Chegam como argumento da janela (ver main/prefs.ts)
const prefsArg = process.argv.find((arg) => arg.startsWith(PREFS_ARG))
const prefs: AuriPrefs = {
  initial: prefsArg ? JSON.parse(prefsArg.slice(PREFS_ARG.length)) : DEFAULT_UI_PREFS,
  save: (value) => ipcRenderer.send('prefs:save', value)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('prefs', prefs)
contextBridge.exposeInMainWorld('connection', connection)
// A interface ajusta espaços e atalhos ao sistema (ex.: botões da janela no Mac, ⌘ x Ctrl)
contextBridge.exposeInMainWorld('platform', process.platform)
