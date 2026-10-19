import { Switch as RadixSwitch } from 'radix-ui'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export function Switch({
  className,
  ...props
}: ComponentProps<typeof RadixSwitch.Root>): React.JSX.Element {
  return (
    <RadixSwitch.Root
      {...props}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-fill-hover p-0.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 data-[state=checked]:bg-ink',
        className
      )}
    >
      <RadixSwitch.Thumb className="block size-4 rounded-full bg-surface shadow-lift transition-transform duration-150 ease-slide data-[state=checked]:translate-x-4" />
    </RadixSwitch.Root>
  )
}

type SwitchFieldProps = {
  label: string
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

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
    <div className={cn('flex items-center justify-between gap-6', className)}>
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
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-descricao` : undefined}
      />
    </div>
  )
}
