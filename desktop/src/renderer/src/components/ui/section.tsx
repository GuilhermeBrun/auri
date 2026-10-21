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
  description?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-crumb={title} className="scroll-mt-8">
      <h2 id={`${id}-titulo`} className="text-[15px] font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-[13px] text-ink-soft">{description}</p>}
      <div className={cn(description ? 'mt-5' : 'mt-3', 'flex flex-col')}>{children}</div>
    </section>
  )
}

const ROWS =
  'flex flex-col [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*+*]:border-t [&>*+*]:border-line [&>[role=alert]]:border-t-0 [&>[role=alert]]:pt-0'

export function SettingsGroup({
  label,
  rows = false,
  className,
  children
}: {
  label?: string
  rows?: boolean
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const id = useId()
  return (
    <section
      aria-labelledby={label ? id : undefined}
      className="border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0"
    >
      {label && (
        <h3 id={id} className="mb-3 text-xs font-medium text-ink-soft">
          {label}
        </h3>
      )}
      <div className={cn(rows && ROWS, className)}>{children}</div>
    </section>
  )
}

export function SettingRow({
  title,
  description,
  children
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {description && <div className="mt-0.5 text-xs text-ink-soft">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

export function GroupText({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="text-xs text-ink-soft">{children}</p>
}

export function FormSection({
  id,
  title,
  description,
  className,
  children
}: {
  id: string
  title: string
  description?: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="grid grid-cols-[200px_1fr] gap-x-8 py-7 first:pt-0">
      <div>
        <div className="sticky top-4">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-xs text-ink-soft">{description}</p>}
        </div>
      </div>
      <div className={cn('grid grid-cols-6 gap-x-3 gap-y-4', className)}>{children}</div>
    </section>
  )
}
