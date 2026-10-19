import { cn } from '@renderer/lib/utils'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const SIZES = {
  xs: 'size-6 rounded-[6px] text-[10px]',
  sm: 'size-7 rounded-chip text-[11px]',
  md: 'size-8 rounded-chip text-xs',
  lg: 'size-12 rounded-card text-lg'
}

type AvatarProps = { name: string; size?: keyof typeof SIZES; className?: string }

export function Avatar({ name, size = 'sm', className }: AvatarProps): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center bg-accent-soft font-semibold tracking-wide text-ink-soft select-none',
        SIZES[size],
        className
      )}
    >
      {initials(name)}
    </span>
  )
}
