import { contextBridge, ipcRenderer } from 'electron'
import {
  DEFAULT_UI_PREFS,
  PREFS_ARG,
  type AuriApi,
  type AuriPrefs,
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
    update: (id, input) => invoke('patients:update', id, input),
    setAtivo: (id, ativo) => invoke('patients:setAtivo', id, ativo)
  },
  appointments: {
    listRange: (de, ate) => invoke('appointments:listRange', de, ate),
    create: (input) => invoke('appointments:create', input),
    update: (id, input) => invoke('appointments:update', id, input),
    remove: (id) => invoke('appointments:remove', id)
  }
}

// Chegam como argumento da janela (ver main/prefs.ts)
const prefsArg = process.argv.find((arg) => arg.startsWith(PREFS_ARG))
const prefs: AuriPrefs = {
  initial: prefsArg ? JSON.parse(prefsArg.slice(PREFS_ARG.length)) : DEFAULT_UI_PREFS,
  save: (value) => ipcRenderer.send('prefs:save', value)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('prefs', prefs)
// A interface ajusta espaços e atalhos ao sistema (ex.: botões da janela no Mac, ⌘ x Ctrl)
contextBridge.exposeInMainWorld('platform', process.platform)
