import { Calendar, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, X } from 'lucide-react'
import { Toast } from 'radix-ui'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { noticeText, type AgendaChange, type AgendaNotice } from '@shared/agenda-notice'

const ICONS: Record<AgendaChange, typeof Calendar> = {
  marcou: CalendarPlus,
  remarcou: CalendarClock,
  alterou: Calendar,
  confirmou: CalendarCheck,
  desmarcou: CalendarX,
  faltou: CalendarX,
  excluiu: CalendarX,
  chegou: CalendarCheck
}

const MAX_VISIBLE = 3
const DURATION = 8000
const EXIT_MS = 400

type Item = { id: number; notice: AgendaNotice; open: boolean }

let nextId = 0

export function AgendaNotices(): React.JSX.Element {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])

  const openAgenda = useCallback(
    (inicio: string): void => void navigate('/agenda', { state: { date: inicio } }),
    [navigate]
  )

  const close = useCallback((id: number): void => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, open: false } : item)))
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), EXIT_MS)
  }, [])

  useEffect(() => {
    const stopOpen = window.api.onOpenAgenda(openAgenda)
    const stopNotice = window.api.onNotice((notice) =>
      setItems((current) => [
        ...current.filter((item) => item.open).slice(1 - MAX_VISIBLE),
        { id: ++nextId, notice, open: true }
      ])
    )
    return () => {
      stopOpen()
      stopNotice()
    }
  }, [openAgenda])

  return (
    <Toast.Provider swipeDirection="right" duration={DURATION} label="Avisos da agenda">
      {items.map(({ id, notice, open }) => {
        const { title, body } = noticeText(notice)
        const Icon = ICONS[notice.change]
        return (
          <Toast.Root
            key={id}
            open={open}
            onOpenChange={(next) => {
              if (!next) close(id)
            }}
            className="group pointer-events-auto relative rounded-sheet bg-raised text-ink shadow-pop data-[state=closed]:not-data-[swipe=end]:animate-notice-out data-[state=open]:animate-notice-in data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-notice-swipe-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)"
          >
            <button
              type="button"
              onClick={() => {
                openAgenda(notice.inicio)
                close(id)
              }}
              className="flex w-full items-start gap-3 rounded-sheet p-3 pr-9 text-left"
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-control bg-fill [&_svg]:size-[18px] [&_svg]:stroke-[1.75]"
              >
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <Toast.Title className="text-[13px] leading-snug font-medium">{title}</Toast.Title>
                <Toast.Description className="mt-0.5 text-xs leading-snug text-ink-soft">
                  {body}
                </Toast.Description>
              </span>
            </button>
            <Toast.Close
              aria-label="Fechar aviso"
              className="absolute top-2 right-2 grid size-6 place-items-center rounded-chip text-ink-soft opacity-0 transition-[opacity,color,background-color] group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-fill hover:text-ink pointer-coarse:size-10 pointer-coarse:opacity-100 [&_svg]:size-3.5 [&_svg]:stroke-[1.75]"
            >
              <X aria-hidden="true" />
            </Toast.Close>
          </Toast.Root>
        )
      })}
      <Toast.Viewport
        hotkey={['altKey', 'KeyN']}
        className="fixed top-14 right-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 outline-none"
      />
    </Toast.Provider>
  )
}
