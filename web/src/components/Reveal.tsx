import { createElement, type CSSProperties, type ReactNode } from 'react'
import { useInView } from '../lib/useInView'

type RevealProps = {
  as?: 'div' | 'h2' | 'article'
  id?: string
  className?: string
  order?: number
  children: ReactNode
}

export function Reveal({ as = 'div', id, className, order, children }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>()
  const classes = [className, inView && 'in'].filter(Boolean).join(' ') || undefined
  const style = order === undefined ? undefined : ({ '--i': order } as CSSProperties)
  return createElement(as, { ref, id, className: classes, style, 'data-reveal': '' }, children)
}
