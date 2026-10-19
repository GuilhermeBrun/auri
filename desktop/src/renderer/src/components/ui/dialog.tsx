import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  media?: ReactNode
  children: ReactNode
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  media,
  children
}: DialogProps): React.JSX.Element {
  const content = useRef<HTMLDivElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          ref={content}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            content.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            const active = document.activeElement
            if (
              active?.getAttribute('role') === 'combobox' &&
              active.getAttribute('aria-expanded') === 'true'
            ) {
              e.preventDefault()
            }
          }}
          className="fixed top-[44%] left-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-sheet bg-raised shadow-pop focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          {media && <div className="px-5 pt-5">{media}</div>}
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div key={title} className="animate-fade-in">
              <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-soft">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-2" aria-label="Fechar">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function DialogBody({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return <div className={cn('px-5 pt-4 pb-5', className)}>{children}</div>
}

export function DialogFooter({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-5">{children}</div>
}
