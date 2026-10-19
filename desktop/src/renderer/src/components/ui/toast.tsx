import { Check, X } from 'lucide-react'
import { Toast } from 'radix-ui'
import { useCallback, useState, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ToastContext, type ToastInput } from '@renderer/lib/toast'

type ToastItem = ToastInput & { id: number }

const MAX_VISIBLE = 3
const ACTION_DURATION = 6000
const EXIT_MS = 400

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((toast: ToastInput): void => {
    setItems((current) => [...current.slice(1 - MAX_VISIBLE), { ...toast, id: ++nextId }])
  }, [])

  const remove = useCallback((id: number): void => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  return (
    <ToastContext value={push}>
      <Toast.Provider swipeDirection="down" duration={4000} label="Avisos">
        {children}
        {items.map((item) => (
          <Toast.Root
            key={item.id}
            defaultOpen
            duration={item.action ? ACTION_DURATION : undefined}
            onOpenChange={(open) => {
              if (!open) setTimeout(() => remove(item.id), EXIT_MS)
            }}
            className="pointer-events-auto flex items-center gap-3 rounded-card bg-raised py-2.5 pr-2 pl-3 text-ink shadow-pop data-[state=closed]:not-data-[swipe=end]:animate-toast-out data-[state=open]:animate-toast-in data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-toast-swipe-out data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)"
          >
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-chip bg-fill [&_svg]:size-4 [&_svg]:stroke-[1.75]"
            >
              {item.icon ?? <Check className="draw-check" />}
            </span>
            <div className="min-w-0 flex-1">
              <Toast.Title className="text-[13px] leading-tight font-medium">
                {item.title}
              </Toast.Title>
              {item.description && (
                <Toast.Description className="mt-0.5 truncate text-xs text-ink-soft">
                  {item.description}
                </Toast.Description>
              )}
            </div>
            {item.action && (
              <Toast.Action asChild altText={item.action.altText}>
                <Button variant="secondary" size="sm" onClick={item.action.onClick}>
                  {item.action.icon}
                  {item.action.label}
                </Button>
              </Toast.Action>
            )}
            <Toast.Close
              aria-label="Fechar aviso"
              className="grid size-7 shrink-0 place-items-center rounded-chip text-ink-soft transition-colors hover:bg-fill hover:text-ink pointer-coarse:size-10 [&_svg]:size-4 [&_svg]:stroke-[1.75]"
            >
              <X aria-hidden="true" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 left-1/2 z-[60] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2 outline-none" />
      </Toast.Provider>
    </ToastContext>
  )
}
