import { useEffect, useState } from 'react'
import { prefsField, usePrefsField } from '@renderer/lib/prefs-field'
import type { WhatsAppEnvio } from '@shared/api'

const whatsapp = prefsField('whatsapp')

export const COLAR_NO_WHATSAPP = 'Se a mensagem não aparecer na conversa, cole: ela está copiada.'

export async function abrirOuCopiar(
  via: 'whatsapp' | 'copiar',
  numero: string,
  mensagem: string
): Promise<WhatsAppEnvio | null> {
  if (via === 'whatsapp') return window.api.terms.openWhatsApp(numero, mensagem)
  await navigator.clipboard.writeText(mensagem)
  return null
}

export function useWhatsAppEnabled(): boolean {
  return usePrefsField(whatsapp)
}

export function setWhatsAppEnabled(on: boolean): void {
  if (on !== whatsapp.get()) whatsapp.set(on)
}

export function useWhatsAppUnread(on: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!on) return
    void window.whatsapp.unread().then(setCount)
    return window.whatsapp.onUnread(setCount)
  }, [on])
  return on ? count : 0
}
