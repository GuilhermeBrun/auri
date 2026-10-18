import { useLayoutEffect, useState, type RefObject } from 'react'

/** As linhas entram e saem do DOM em blocos: rolar só redesenha a cada BLOCK linhas. */
const BLOCK = 10

type RowRange = { start: number; end: number }

/** O ancestral mais próximo que rola (ex.: o conteúdo da `Page`). */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
  }
  return document.documentElement
}

/**
 * Rola a lista até a linha `index` se ela estiver fora da área visível, deixando-a no meio. Serve
 * para mostrar o paciente recém-salvo, que numa lista longa pode estar muito abaixo. `stickyTop` é a
 * altura do cabeçalho fixo, que cobre o topo da área de rolagem. Rola de uma vez, sem animar: a lista
 * é virtualizada e passar por centenas de linhas no caminho não ajuda.
 */
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

/**
 * Lista longa com linhas de altura fixa: devolve o trecho [start, end) que precisa estar no DOM (o
 * que aparece na área de rolagem, arredondado em blocos, mais um bloco de folga acima e abaixo). O
 * resto da lista vira espaço reservado, então a tela monta umas 40 linhas em vez de centenas.
 * `list` é o elemento onde as linhas começam (ex.: o <tbody>).
 */
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
      // onde a lista começa, medido a partir do topo do conteúdo rolável
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
