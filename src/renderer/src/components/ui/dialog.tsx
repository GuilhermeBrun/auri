import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

/**
 * Folha sólida: fundo `raised` (branco no claro, um tom acima do conteúdo no escuro), sombra única e o resto da janela escurecido. Sem transparência,
 * então fica igual em qualquer sistema e o texto de trás nunca vaza. Entra em 140ms e sai em 110ms
 * (o Radix espera a animação de saída acabar antes de tirar a folha da tela), por isso quem
 * fecha o diálogo deve manter o conteúdo montado até lá.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children
}: DialogProps): React.JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            // Esc com uma lista de sugestões aberta fecha só a lista, não o diálogo
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
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
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

/** Conteúdo do diálogo. */
export function DialogBody({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return <div className={cn('px-5 pt-4 pb-5', className)}>{children}</div>
}

/** Rodapé: atalhos e ação secundária à esquerda, botões à direita. Faixa cinza, sem filete: o fundo já separa. */
export function DialogFooter({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-b-sheet bg-canvas px-5 py-3">
      {children}
    </div>
  )
}
