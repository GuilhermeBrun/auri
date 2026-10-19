import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
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
      <h3 className="text-[13px] font-medium">{title}</h3>
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

export function PageSection({
  id,
  title,
  description,
  children
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-8">
      <h2 id={`${id}-titulo`} className="text-[15px] font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-ink-soft">{description}</p>
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  )
}

export function SettingsGroup({
  label,
  bare = false,
  className,
  children
}: {
  label?: string
  bare?: boolean
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const id = useId()
  return (
    <section aria-labelledby={label ? id : undefined}>
      {label && (
        <h3 id={id} className="mb-2 text-xs font-medium text-ink-soft">
          {label}
        </h3>
      )}
      <div className={cn(!bare && 'rounded-card bg-fill p-4', className)}>{children}</div>
    </section>
  )
}

export function GroupText({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="text-xs text-ink-soft">{children}</p>
}
