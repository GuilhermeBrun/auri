import { createElement, type CSSProperties, type ReactNode } from 'react'
import { useInView } from '../lib/useInView'

type RevealProps = {
  as?: 'div' | 'h2' | 'article'
  id?: string
  className?: string
  /** Ordem da entrada dentro do grupo (`--i` no CSS). */
  order?: number
  children: ReactNode
}

/** Elemento que entra quando aparece na tela (`[data-reveal].in` no CSS). */
export function Reveal({ as = 'div', id, className, order, children }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>()
  const classes = [className, inView && 'in'].filter(Boolean).join(' ') || undefined
  const style = order === undefined ? undefined : ({ '--i': order } as CSSProperties)
  return createElement(as, { ref, id, className: classes, style, 'data-reveal': '' }, children)
}
