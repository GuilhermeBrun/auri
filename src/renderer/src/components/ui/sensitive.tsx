import { useState, type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

type SensitiveProps = {
  /** O que é, para o leitor de tela enquanto está oculto ("Endereço deste computador"). */
  label: string
  children: ReactNode
  className?: string
}

/**
 * Informação que não deve aparecer por acaso (endereço na rede, código de pareamento): fica
 * borrada até um clique, como dados de conta em apps de tecnologia, e um novo clique esconde de
 * novo. Protege de quem olha a tela por cima do ombro, de capturas e de compartilhamento de tela.
 * O borrão acompanha o tamanho do texto (em `em`), então esconde do código grande ao endereço
 * pequeno. Oculto, o leitor de tela ouve só o rótulo e o texto não pode ser selecionado.
 */
export function Sensitive({ label, children, className }: SensitiveProps): React.JSX.Element {
  const [shown, setShown] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setShown((current) => !current)}
      aria-pressed={shown}
      aria-label={shown ? undefined : `${label}: oculto. Clique para mostrar`}
      title={shown ? 'Clique para ocultar' : 'Clique para mostrar'}
      className={cn(
        'cursor-pointer rounded-chip text-left transition-[filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        !shown && 'blur-[0.4em] select-none',
        className
      )}
    >
      <span aria-hidden={!shown}>{children}</span>
    </button>
  )
}
