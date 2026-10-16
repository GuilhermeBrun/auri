import { useState, type ReactNode } from 'react'
import { Tooltip } from 'radix-ui'
import { cn } from '@renderer/lib/utils'

type SensitiveProps = {
  /** O que é, para o leitor de tela enquanto está oculto ("Endereço deste computador"). */
  label: string
  /** Como a dica chama o dado, com artigo ("o endereço"): vira "Clique para mostrar o endereço". */
  what: string
  children: ReactNode
  className?: string
}

/**
 * Informação que não deve aparecer por acaso (endereço na rede, código de pareamento): fica
 * borrada até um clique, como dados de conta em apps de tecnologia, e um novo clique esconde de
 * novo. Protege de quem olha a tela por cima do ombro, de capturas e de compartilhamento de tela.
 * Oculta, ganha um fundo um tom mais escuro que escurece mais sob o ponteiro, e uma dica em
 * pílula acima diz o que o clique faz. O borrão acompanha o tamanho do texto (em `em`), então
 * esconde do código grande ao endereço pequeno. Oculto, o leitor de tela ouve só o rótulo e o
 * texto não pode ser selecionado. A dica vai num portal, então não é cortada por `truncate`.
 * O texto corta com reticências quando não cabe (a pasta do Backup); por isso o botão se alinha pelo
 * topo, porque o corte tira a linha de base e o deixaria uns pixels acima do texto ao redor.
 */
export function Sensitive({ label, what, children, className }: SensitiveProps): React.JSX.Element {
  const [shown, setShown] = useState(false)
  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={() => setShown((current) => !current)}
            aria-pressed={shown}
            aria-label={shown ? undefined : `${label}: oculto. Clique para mostrar`}
            className={cn(
              'max-w-full cursor-pointer rounded-chip align-top px-1 text-left transition-[filter,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              !shown && 'bg-fill select-none hover:bg-fill-hover',
              className
            )}
          >
            {/* o borrão espalha além do texto: o recorte (do tamanho do fundo, com o px-1) o
                mantém dentro do fundo */}
            <span
              aria-hidden={!shown}
              style={shown ? undefined : { clipPath: 'inset(0 -0.25rem round var(--radius-chip))' }}
              className={cn('block truncate transition-[filter]', !shown && 'blur-[0.4em]')}
            >
              {children}
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-50 rounded-full bg-solid px-3 py-1.5 text-[13px] font-medium text-on-solid shadow-lift select-none data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in"
          >
            {shown ? `Clique para ocultar ${what}` : `Clique para mostrar ${what}`}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
