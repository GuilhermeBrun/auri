import { useLayoutEffect, useRef } from 'react'
import { Navigate } from 'react-router'
import { Page } from '@renderer/components/Layout'
import { useHomePath, useWhatsAppActive } from '@renderer/lib/sidebar'

const SETTLE_MS = 250

export function WhatsAppPage(): React.JSX.Element {
  const enabled = useWhatsAppActive()
  const home = useHomePath()
  const area = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = area.current
    if (!enabled || !element) return
    let frame = 0
    const sync = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
          void window.whatsapp.hide()
          return
        }
        const box = element.getBoundingClientRect()
        void window.whatsapp.show({
          x: box.left,
          y: box.top,
          width: box.width,
          height: box.height
        })
      })
    }
    sync()
    const settle = setTimeout(sync, SETTLE_MS)
    const resized = new ResizeObserver(sync)
    resized.observe(element)
    const dialogs = new MutationObserver(sync)
    dialogs.observe(document.body, { childList: true })
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      resized.disconnect()
      dialogs.disconnect()
      window.removeEventListener('resize', sync)
      void window.whatsapp.hide()
    }
  }, [enabled])

  if (!enabled) return <Navigate to={home} replace />
  return (
    <Page trail={[{ label: 'WhatsApp' }]} bodyClassName="overflow-hidden">
      <div ref={area} className="h-full w-full bg-fill" />
    </Page>
  )
}
