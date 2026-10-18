import { Switch as RadixSwitch } from 'radix-ui'
import { useId, type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

type SwitchFieldProps = {
  label: string
  /** Segunda linha em cinza: o que acontece quando está ligado. */
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

/**
 * Liga/desliga com o texto à esquerda, para ajustes que valem na hora (sem botão de salvar).
 * Clicar no texto também alterna. Ligado, o trilho fica na cor do texto (grafite no claro, quase
 * branco no escuro), para "ligado" e "desligado" não dependerem de um cinza sutil; a bolinha
 * desliza (instantânea em "Reduzir movimento", ver main.css).
 */
export function SwitchField({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  className
}: SwitchFieldProps): React.JSX.Element {
  const id = useId()
  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-descricao`} className="mt-0.5 text-xs text-ink-soft">
            {description}
          </p>
        )}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-descricao` : undefined}
        className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-fill-hover p-0.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 data-[state=checked]:bg-ink pointer-coarse:mt-0"
      >
        <RadixSwitch.Thumb className="block size-4 rounded-full bg-surface shadow-lift transition-transform duration-150 ease-slide data-[state=checked]:translate-x-4" />
      </RadixSwitch.Root>
    </div>
  )
}
