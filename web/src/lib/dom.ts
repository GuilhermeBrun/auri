import { useEffect, useLayoutEffect } from 'react'

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

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

export const noSubscription = () => () => {}
