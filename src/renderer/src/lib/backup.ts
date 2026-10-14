import { useEffect, useState, useSyncExternalStore } from 'react'
import type { BackupDestination, BackupInfo, InstallProgress } from '@shared/api'

/** null até a primeira resposta do main (uma fração de segundo na abertura). */
let snapshot: BackupInfo | null = null
const listeners = new Set<() => void>()

function set(info: BackupInfo): void {
  snapshot = info
  for (const listener of listeners) listener()
}

window.backup.onChange(set)
void window.backup.info().then(set)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Estado da cópia de segurança (Configurações / Cópia de segurança), atualizado pelo main. */
export function useBackup(): BackupInfo | null {
  return useSyncExternalStore(subscribe, () => snapshot)
}

/** Atualiza já com a resposta de uma ação, sem esperar o aviso do main. */
export function setBackupInfo(info: BackupInfo): void {
  set(info)
}

/** "hoje às 19:02", "ontem às 19:02", "12/10 às 19:02". */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (diff === 0) return `hoje às ${time}`
  if (diff === 1) return `ontem às ${time}`
  const label = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  })
  return `${label} às ${time}`
}

export const DESTINATION_LABEL: Record<BackupDestination['kind'], string> = {
  google: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive',
  folder: 'Pasta escolhida'
}

export const MIN_PASSWORD = 8

/** Erro da senha nova, ou null se está boa. Mostrado só depois de tentar continuar. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  }
  if (password !== confirm) return 'As duas senhas não são iguais.'
  return null
}

/** Andamento de "Instalar" de cada nuvem, que chega do main por aviso. */
export function useInstallProgress(): Partial<Record<string, InstallProgress>> {
  const [progress, setProgress] = useState<Partial<Record<string, InstallProgress>>>({})
  useEffect(
    () =>
      window.backup.onInstallProgress((next) =>
        setProgress((current) => ({ ...current, [next.id]: next }))
      ),
    []
  )
  return progress
}

/**
 * A cópia ligada precisa de atenção: a nuvem deixou de funcionar, a pasta sumiu ou a última
 * tentativa falhou. Vira marca em Configurações e aviso ao abrir o Auri.
 */
export function needsAttention(info: BackupInfo | null): boolean {
  if (!info?.available || !info.configured) return false
  const failed =
    info.lastError !== null && (!info.lastSuccessAt || info.lastError.at > info.lastSuccessAt)
  return info.destinationProblem !== null || info.folderMissing || failed
}
