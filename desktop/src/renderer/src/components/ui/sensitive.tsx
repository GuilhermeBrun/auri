import { useState, type ReactNode } from 'react'
import { Tooltip } from 'radix-ui'
import { cn } from '@renderer/lib/utils'

type SensitiveProps = {
  label: string
  what: string
  children: ReactNode
  className?: string
}

export function SensitiveHint({
  shown,
  what,
  children
}: {
  shown: boolean
  what: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
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

export function Sensitive({ label, what, children, className }: SensitiveProps): React.JSX.Element {
  const [shown, setShown] = useState(false)
  return (
    <SensitiveHint shown={shown} what={what}>
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
        <span
          aria-hidden={!shown}
          style={shown ? undefined : { clipPath: 'inset(0 -0.25rem round var(--radius-chip))' }}
          className={cn('block truncate transition-[filter]', !shown && 'blur-[0.4em]')}
        >
          {children}
        </span>
      </button>
    </SensitiveHint>
  )
}
