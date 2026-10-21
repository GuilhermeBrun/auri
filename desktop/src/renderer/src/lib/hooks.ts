import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

const BLOCK = 10

type RowRange = { start: number; end: number }

function scrollParent(el: HTMLElement): HTMLElement {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
  }
  return document.documentElement
}

export function revealRow(
  list: HTMLElement,
  index: number,
  rowHeight: number,
  stickyTop: number
): void {
  const scrollEl = scrollParent(list)
  const offset =
    list.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop
  const top = offset + index * rowHeight
  const visible =
    top >= scrollEl.scrollTop + stickyTop &&
    top + rowHeight <= scrollEl.scrollTop + scrollEl.clientHeight
  if (!visible) scrollEl.scrollTop = Math.max(0, top - (scrollEl.clientHeight - rowHeight) / 2)
}

export function useVirtualRows(
  list: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number
): RowRange {
  const [range, setRange] = useState<RowRange>({ start: 0, end: 4 * BLOCK })

  useLayoutEffect(() => {
    const listEl = list.current
    if (!listEl) return
    const scrollEl = scrollParent(listEl)
    const update = (): void => {
      const offset =
        listEl.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop
      const first = Math.max(0, Math.floor((scrollEl.scrollTop - offset) / rowHeight))
      const last = first + Math.ceil(scrollEl.clientHeight / rowHeight)
      const start = Math.max(0, (Math.floor(first / BLOCK) - 1) * BLOCK)
      const end = (Math.floor(last / BLOCK) + 2) * BLOCK
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }))
    }
    update()
    scrollEl.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scrollEl)
    return () => {
      scrollEl.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [list, count, rowHeight])

  return { start: Math.min(range.start, count), end: Math.min(range.end, count) }
}

type Thumb = { x: number; width: number }

export function useThumb(value: unknown): [RefObject<HTMLDivElement | null>, Thumb | null] {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<Thumb | null>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = (): void => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!active) return setThumb(null)
      const next = { x: active.offsetLeft, width: active.offsetWidth }
      setThumb((prev) => (prev?.x === next.x && prev.width === next.width ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [value])

  return [trackRef, thumb]
}
