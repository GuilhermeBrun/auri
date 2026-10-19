import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export function ErrorText({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <p
      role="alert"
      className={cn(
        'mt-2 flex animate-error-in items-start gap-1.5 text-xs text-danger',
        className
      )}
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 stroke-[2]" aria-hidden="true" />
      {children}
    </p>
  )
}

export function SectionTitle({
  title,
  children
}: {
  title: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <>
      <h2 className="text-[13px] font-medium">{title}</h2>
      {children && <p className="mt-0.5 text-xs text-ink-soft">{children}</p>}
    </>
  )
}

export function StatusDot({ on }: { on: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2 shrink-0 rounded-full', on ? 'bg-ink' : 'bg-line-strong')}
    />
  )
}
