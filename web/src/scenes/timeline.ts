import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/dom'

export const WIDTH = 860
export const HEIGHT = 538

export type Beat = { ms: number; to?: string; click?: boolean; hide?: boolean }

export function useTimeline(beats: Beat[], still: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [beat, setBeat] = useState(still)
  const [playing, setPlaying] = useState(false)
  const [moving, setMoving] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window) || prefersReducedMotion()) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          setMoving(true)
          setBeat(0)
        }
        setPlaying(entry.isIntersecting)
      },
      { threshold: 0.35 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(
      () => setBeat((current) => (current + 1) % beats.length),
      beats[beat].ms
    )
    return () => clearTimeout(timer)
  }, [playing, beat, beats])

  return { ref, beat, moving }
}
