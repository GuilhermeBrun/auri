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
  size?: 'default' | 'wide'
  dismissible?: boolean
  children: ReactNode
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  media,
  size = 'default',
  dismissible = true,
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
              !dismissible ||
              (active?.getAttribute('role') === 'combobox' &&
                active.getAttribute('aria-expanded') === 'true')
            ) {
              e.preventDefault()
            }
          }}
          onInteractOutside={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          className="pointer-events-none! fixed inset-0 z-50 flex flex-col items-center p-4 before:flex-[2] after:flex-[3] focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <div
            className={cn(
              'pointer-events-auto flex max-h-full min-h-0 w-full flex-col rounded-sheet bg-raised shadow-pop',
              size === 'wide' ? 'max-w-[720px]' : 'max-w-[560px]'
            )}
          >
            {media && <div className="shrink-0 px-5 pt-5">{media}</div>}
            <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
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
              {dismissible && (
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-2"
                    aria-label="Fechar"
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              )}
            </div>
            <div className="flex min-h-0 flex-col [&>form]:flex [&>form]:min-h-0 [&>form]:flex-col">
              {children}
            </div>
          </div>
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
  return (
    <div className={cn('min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-5', className)}>
      {children}
    </div>
  )
}

export function DialogFooter({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-1 pb-5">
      {children}
    </div>
  )
}
