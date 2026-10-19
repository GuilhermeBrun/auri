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
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  invalid?: boolean
  disabled?: boolean
  compact?: boolean
}

export function Select({
  id,
  value,
  onValueChange,
  options,
  invalid,
  disabled,
  compact
}: SelectProps): React.JSX.Element {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          controlClass,
          'flex items-center justify-between gap-2 pr-2.5 text-left pointer-coarse:h-11',
          compact ? 'h-8' : 'h-9',
          'data-[state=open]:border-ink data-[state=open]:ring-[3px] data-[state=open]:ring-ink/10'
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
