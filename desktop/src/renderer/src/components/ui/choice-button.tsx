import { cn } from '@renderer/lib/utils'

export function ChoiceButton({
  pressed,
  onClick,
  children
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center gap-2 rounded-control px-4 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        pressed
          ? 'bg-solid text-on-solid [&_.text-ink-soft]:text-on-solid/70'
          : 'bg-fill hover:bg-fill-hover'
      )}
    >
      {children}
    </button>
  )
}
