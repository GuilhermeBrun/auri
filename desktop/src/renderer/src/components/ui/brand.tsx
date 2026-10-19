import { cn } from '@renderer/lib/utils'

const SYMBOL_PATH =
  'M10 51C3 52 0 46 1 37C5 16 29 0 52 0C84 0 105 19 106 47L106 66C106 76 109 80 113 84C123 96 116 110 102 110C90 110 82 103 74 92L63 77C56 67 49 67 41 73C31 80 27 89 31 96C35 103 44 106 48 109C34 114 15 111 7 101C-1 92-2 77 5 66C13 55 27 49 39 49C58 49 68 58 78 70C82 75 85 80 88 77C90 75 89 70 89 64L88 53C87 40 82 32 73 30C61 25 52 31 40 39L20 49C16 51 12 52 10 51Z'

type SymbolProps = {
  className?: string
  animated?: boolean
}

export function AuriSymbol({ className, animated }: SymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="-2 -2 122 116"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('inline-block size-4 shrink-0', animated && 'animate-brand-pulse', className)}
    >
      <path d={SYMBOL_PATH} />
    </svg>
  )
}

export function AuriLogo({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 268 118"
      fill="currentColor"
      role="img"
      aria-label="Auri"
      focusable="false"
      className={cn('h-auto w-14 shrink-0', className)}
    >
      <g transform="translate(10 33) scale(0.64)">
        <path d={SYMBOL_PATH} />
      </g>
      <g transform="translate(-118 2)">
        <path d="M218 38H231C236 38 239 41 239 46V74C239 82 243 87 251 87C260 87 264 81 264 74V46C264 41 267 38 272 38H284V75C284 94 271 103 251 103C231 103 218 94 218 75V38Z" />
        <path d="M296 38H314V46C320 39 328 36 340 37V55C324 55 315 62 315 75V94C315 99 312 101 307 101H296V38Z" />
        <path d="M358 38H366C371 38 374 41 374 46V93C374 98 371 101 366 101H358C353 101 350 98 350 93V46C350 41 353 38 358 38Z" />
        <circle cx="362" cy="22" r="11" />
      </g>
    </svg>
  )
}

export function AuriSymbolFill({
  done,
  className
}: {
  done?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span aria-hidden="true" className={cn('relative inline-block size-4 shrink-0', className)}>
      <AuriSymbol className="absolute inset-0 size-full opacity-25" />
      <span className={cn('symbol-fill absolute inset-0', done && 'symbol-fill-done')}>
        <AuriSymbol className="size-full" />
      </span>
    </span>
  )
}
