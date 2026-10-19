import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '@renderer/lib/toast'
import type { SettingsPreview } from '@shared/api'

export type ImportState = ReturnType<typeof useSettingsImport>

export function useSettingsImport(onApplied?: () => void) {
  const toast = useToast()
  const [preview, setPreview] = useState<SettingsPreview | null>(null)
  const pick = useMutation({
    mutationFn: () => window.transfer.pickSettings(),
    onSuccess: (next) => next && setPreview(next)
  })
  const apply = useMutation({
    mutationFn: (token: string) => window.transfer.applySettings(token),
    onSuccess: () => {
      setPreview(null)
      toast({ title: 'Configurações importadas' })
      onApplied?.()
    }
  })
  return { preview, cancel: () => setPreview(null), pick, apply }
}
