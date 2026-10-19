import { CircleAlert } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { controlClass } from '@renderer/components/ui/field-style'
import { cn } from '@renderer/lib/utils'

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }): React.JSX.Element {
  return (
    <input
      ref={ref}
      className={cn(controlClass, 'h-9 pointer-coarse:h-11', className)}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>
}): React.JSX.Element {
  return (
    <textarea
      ref={ref}
      className={cn(controlClass, 'min-h-16 resize-y py-2', className)}
      {...props}
    />
  )
}

type FieldProps = {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
  as?: 'label' | 'group'
  htmlFor?: string
  children: ReactNode
}

export function Field({
  label,
  error,
  hint,
  className,
  as = 'label',
  htmlFor,
  children
}: FieldProps): React.JSX.Element {
  const captionClass = 'flex items-baseline justify-between gap-2 text-xs font-medium text-ink'
  const caption = (
    <>
      {label}
      {hint && <span className="font-medium text-ink-soft">{hint}</span>}
    </>
  )
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {htmlFor ? (
        <>
          <label htmlFor={htmlFor} className={captionClass}>
            {caption}
          </label>
          {children}
        </>
      ) : as === 'label' ? (
        <label className="flex flex-col gap-1">
          <span className={captionClass}>{caption}</span>
          {children}
        </label>
      ) : (
        <div role="group" aria-label={label} className="flex flex-col gap-1">
          <span className={captionClass}>{caption}</span>
          {children}
        </div>
      )}
      {error && (
        <span className="flex animate-error-in items-start gap-1.5 text-xs text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 stroke-[2]" aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  )
}
