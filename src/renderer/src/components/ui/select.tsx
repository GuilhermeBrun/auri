import { Check, ChevronDown } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import {
  controlClass,
  optionClass,
  popupClass,
  trailingIconClass
} from '@renderer/components/ui/field-style'
import { cn } from '@renderer/lib/utils'

type SelectProps = {
  /** Mesmo `id` do `htmlFor` do `Field`: clicar no rótulo abre a lista. */
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  invalid?: boolean
}

/**
 * Seletor de uma opção entre poucas. No lugar do <select> nativo, que abre o menu do sistema (outro
 * visual em cada Mac e Windows): o campo é igual ao `Input` e a lista é a mesma do campo de
 * paciente. Setas, Home/End, digitar a inicial e Esc vêm do Radix.
 */
export function Select({
  id,
  value,
  onValueChange,
  options,
  invalid
}: SelectProps): React.JSX.Element {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          controlClass,
          'flex h-9 items-center justify-between gap-2 pr-2.5 text-left pointer-coarse:h-11',
          // aberto, o campo fica com o contorno do foco (o foco já está na lista)
          'data-[state=open]:border-ink data-[state=open]:ring-[3px] data-[state=open]:ring-black/10'
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className={cn(trailingIconClass, 'shrink-0')} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            popupClass,
            'z-[60] max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in'
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className={optionClass}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check className={trailingIconClass} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
