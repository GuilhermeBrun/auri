import { useEffect, useLayoutEffect } from 'react'

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** useLayoutEffect no navegador; na pré-renderização (servidor) ele não roda e só avisaria. */
export const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Desliza o bloco `.thumb` de um seletor até o botão escolhido. */
export function moveThumb(
  group: Element | null | undefined,
  button: Element | null | undefined,
  animate = true
) {
  const thumb = group?.querySelector<HTMLElement>('.thumb')
  if (!thumb || !(button instanceof HTMLElement)) return
  thumb.style.transition = animate ? '' : 'none'
  thumb.style.width = `${button.offsetWidth}px`
  thumb.style.transform = `translateX(${button.offsetLeft}px)`
}

/** Para `useSyncExternalStore` com um valor que não muda depois de lido (sistema de quem visita). */
export const noSubscription = () => () => {}
