import { useMemo } from 'react'
import { cn } from '@renderer/lib/utils'
import { deBase64url } from '../../../../../web/contrato/assinatura/base64url'
import {
  ALTURA,
  LARGURA,
  decodificar,
  tracoParaSvg
} from '../../../../../web/contrato/assinatura/traco'

function paths(traco: string): string[] {
  try {
    return decodificar(deBase64url(traco)).map(tracoParaSvg)
  } catch {
    return []
  }
}

export function SignatureImage({
  traco,
  label,
  strokeWidth = 1.5,
  className
}: {
  traco: string
  label: string
  strokeWidth?: number
  className?: string
}): React.JSX.Element {
  const d = useMemo(() => paths(traco), [traco])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('aspect-[5/2] text-ink', className)}
    >
      {d.map((path, i) => (
        <path
          key={i}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
