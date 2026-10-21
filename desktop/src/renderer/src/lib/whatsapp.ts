import { useEffect, useState } from 'react'
import { prefsField, usePrefsField } from '@renderer/lib/prefs-field'

const whatsapp = prefsField('whatsapp')

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
