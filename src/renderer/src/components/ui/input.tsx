import { CircleAlert } from 'lucide-react'
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'
import { cn } from '@renderer/lib/utils'

// Campos brancos com contorno de 3:1 (WCAG 1.4.11). No foco o contorno vira grafite com um anel
// suave; no erro, vermelho (e a mensagem, com ícone, aparece abaixo).
const controlClass =
  'w-full rounded-control border border-control bg-surface px-3 text-[13px] text-ink transition-[background-color,border-color,box-shadow] placeholder:text-ink-faint hover:border-ink-soft focus:border-ink focus:ring-[3px] focus:ring-black/10 focus:outline-none aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger/[0.03] aria-[invalid=true]:focus:ring-danger/15 disabled:border-line disabled:bg-canvas disabled:text-ink-faint pointer-coarse:text-base'

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

export function Select({
  className,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }): React.JSX.Element {
  return (
    <select
      ref={ref}
      className={cn(controlClass, 'select-chevron h-9 pr-8 pointer-coarse:h-11', className)}
      {...props}
    />
  )
}

type FieldProps = {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
  /**
   * 'label' (padrão): o <label> envolve o controle, então clicar no texto foca o campo.
   * 'group': para controles compostos (com botões ou listas dentro), que não podem ficar
   * dentro de um <label>; o controle deve receber aria-label próprio.
   */
  as?: 'label' | 'group'
  children: ReactNode
}

export function Field({
  label,
  error,
  hint,
  className,
  as = 'label',
  children
}: FieldProps): React.JSX.Element {
  const caption = (
    <span className="flex items-baseline justify-between gap-2 text-xs font-medium text-ink">
      {label}
      {hint && <span className="font-medium text-ink-soft">{hint}</span>}
    </span>
  )
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {as === 'label' ? (
        <label className="flex flex-col gap-1">
          {caption}
          {children}
        </label>
      ) : (
        <div role="group" aria-label={label} className="flex flex-col gap-1">
          {caption}
          {children}
        </div>
      )}
      {/* fora do <label> para não virar parte do nome do campo; ícone + texto, nunca só cor */}
      {error && (
        <span className="flex items-start gap-1.5 text-xs text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 stroke-[2]" aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  )
}
