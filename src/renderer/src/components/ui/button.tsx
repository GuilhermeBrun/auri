import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { AuriSymbol } from '@renderer/components/ui/brand'
import { cn } from '@renderer/lib/utils'

// Botões retangulares de cantos arredondados (`rounded-control`). Ao pressionar encolhem 3% (150ms,
// interrompível) e ao habilitar/desabilitar o preenchimento se desfaz aos poucos. Só o principal é cheio (grafite). `outline` é o botão comum das barras de
// ferramentas; `secondary` (preenchimento neutro) vai dentro de diálogos; `night` é para a barra
// lateral escura. O destrutivo usa vermelho no texto, nunca como botão principal. Em tela de toque
// (`pointer-coarse`) os alvos crescem para 44px.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-[background-color,color,box-shadow,opacity,scale] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 data-[loading=true]:disabled:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover active:bg-black',
        outline:
          'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-canvas active:bg-accent-soft',
        secondary: 'bg-fill text-ink hover:bg-fill-hover active:bg-fill-hover',
        ghost: 'text-ink-soft hover:bg-fill hover:text-ink active:bg-fill-hover',
        night: 'text-night-soft hover:bg-white/10 hover:text-night-ink active:bg-white/15',
        danger: 'bg-danger/10 text-danger hover:bg-danger/15 active:bg-danger/20',
        'danger-ghost': 'text-danger hover:bg-danger/8 active:bg-danger/15'
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
    /** Ação em andamento: mostra o símbolo da marca à esquerda do rótulo e bloqueia o clique. */
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  type = 'button',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <AuriSymbol animated />}
      {children}
    </button>
  )
}
