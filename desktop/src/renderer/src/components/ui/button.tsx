import { cva, type VariantProps } from 'class-variance-authority'
import { useEffect, useState, type ButtonHTMLAttributes } from 'react'
import { AuriSymbolFill } from '@renderer/components/ui/brand'
import { cn } from '@renderer/lib/utils'

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-[background-color,color,box-shadow,opacity,scale] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 data-[loading=true]:disabled:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        primary: 'bg-solid text-on-solid hover:bg-solid-hover active:bg-solid-active',
        secondary: 'bg-fill text-ink hover:bg-fill-hover active:bg-fill-hover',
        ghost:
          'text-ink-soft hover:bg-fill hover:text-ink active:bg-fill-hover aria-pressed:bg-fill-hover aria-pressed:text-ink',
        danger: 'bg-danger-soft text-danger hover:bg-danger-soft-hover active:bg-danger-soft-hover',
        'danger-ghost': 'text-danger hover:bg-danger-soft active:bg-danger-soft-hover'
      },
      size: {
        sm: 'h-7 px-2.5 text-xs pointer-coarse:h-10',
        md: 'h-8 px-3.5 text-[13px] pointer-coarse:h-11',
        lg: 'h-9 px-4 text-[13px] pointer-coarse:h-12',
        icon: 'size-8 pointer-coarse:size-11',
        'icon-sm': 'size-7 pointer-coarse:size-10'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

type Phase = 'idle' | 'loading' | 'done'

const DONE_MS = 360

function useLoadingPhase(loading: boolean): Phase {
  const [phase, setPhase] = useState<Phase>(loading ? 'loading' : 'idle')
  if (loading && phase !== 'loading') setPhase('loading')
  if (!loading && phase === 'loading') setPhase('done')
  useEffect(() => {
    if (phase !== 'done') return
    const timer = setTimeout(() => setPhase('idle'), DONE_MS)
    return () => clearTimeout(timer)
  }, [phase])
  return phase
}

export function Button({
  className,
  variant,
  size,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const phase = useLoadingPhase(loading)
  const busy = phase !== 'idle'
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center gap-1.5',
          phase === 'loading' && 'opacity-0',
          phase === 'done' && 'transition-opacity delay-200 duration-150'
        )}
      >
        {children}
      </span>
      {busy && (
        <span
          className={cn(
            'absolute inset-0 flex animate-fade-in items-center justify-center',
            phase === 'done' && 'opacity-0 transition-opacity delay-200 duration-150'
          )}
        >
          <AuriSymbolFill done={phase === 'done'} />
        </span>
      )}
    </button>
  )
}
