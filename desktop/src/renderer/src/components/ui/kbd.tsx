import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export function Kbd({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-[6px] bg-fill px-1 font-sans text-xs font-medium text-ink-soft',
        className
      )}
    >
      {children}
    </kbd>
  )
}
