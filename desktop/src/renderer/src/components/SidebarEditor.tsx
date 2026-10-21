import { Ellipsis, GripVertical, RotateCcw } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import {
  arrangeSidebar,
  DEFAULT_SIDEBAR_ITEMS,
  isDefaultSidebar,
  type ArrangedItem
} from '@shared/sidebar'
import { optionClass, popupClass } from '@renderer/components/ui/field-style'
import { Switch } from '@renderer/components/ui/switch'
import {
  navItemClass,
  saveSidebarItems,
  SIDEBAR_ICONS,
  useAvailableItems,
  useSidebarItems
} from '@renderer/lib/sidebar'
import { cn } from '@renderer/lib/utils'

const ROW = 32
const GAP = 2
const STRIDE = ROW + GAP
const LABEL = 'Personalizar a barra lateral'

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

type Drag = { id: string; from: number; to: number; startY: number; dy: number }

function ItemsEditor(): React.JSX.Element {
  const prefs = useSidebarItems()
  const available = useAvailableItems()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [status, setStatus] = useState('')
  const [domOrder] = useState<string[]>(() => available.map((item) => item.id))
  const hintId = useId()
  const firstGrip = useRef<HTMLButtonElement>(null)

  const last = available.length - 1
  const shown = available.filter((item) => !item.hidden).length
  const preview = drag ? move(available, drag.from, drag.to) : available
  const rank = (id: string): number => {
    const i = domOrder.indexOf(id)
    return i < 0 ? domOrder.length : i
  }
  const rows = [...available].sort((a, b) => rank(a.id) - rank(b.id))

  function reorder(from: number, to: number): void {
    const next = move(available, from, to)
    const ids = new Set(next.map((item) => item.id))
    let k = 0
    const order = arrangeSidebar(prefs).map((item) => (ids.has(item.id) ? next[k++].id : item.id))
    saveSidebarItems({ ...prefs, order })
    setStatus(`${available[from].label}, ${to + 1} de ${available.length}`)
  }

  function setShown(item: ArrangedItem, on: boolean): void {
    const hidden = prefs.hidden.filter((id) => id !== item.id)
    saveSidebarItems({ ...prefs, hidden: on ? hidden : [...hidden, item.id] })
  }

  function onKeyDown(e: KeyboardEvent, index: number): void {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null
    if (to === null) return
    e.preventDefault()
    if (to >= 0 && to <= last) reorder(index, to)
  }

  function onPointerDown(e: PointerEvent<HTMLLIElement>, item: ArrangedItem): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[role="switch"]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const from = available.indexOf(item)
    setDrag({ id: item.id, from, to: from, startY: e.clientY, dy: 0 })
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag) return
    const dy = e.clientY - drag.startY
    const to = Math.min(Math.max(drag.from + Math.round(dy / STRIDE), 0), last)
    setDrag({ ...drag, dy, to })
  }

  function onPointerUp(): void {
    if (drag && drag.to !== drag.from) reorder(drag.from, drag.to)
    setDrag(null)
  }

  return (
    <>
      <p id={hintId} className="sr-only">
        Arraste para mudar a ordem. No teclado, use as setas para cima e para baixo.
      </p>
      <ul
        aria-label="Itens da barra lateral"
        className="relative"
        style={{ height: available.length * STRIDE - GAP }}
      >
        {rows.map((item) => {
          const Icon = SIDEBAR_ICONS[item.id]
          const index = available.indexOf(item)
          const slot = preview.indexOf(item)
          const dragging = drag?.id === item.id
          const y = dragging
            ? Math.min(Math.max(drag.from * STRIDE + drag.dy, 0), last * STRIDE)
            : slot * STRIDE
          return (
            <li
              key={item.id}
              aria-posinset={slot + 1}
              aria-setsize={available.length}
              onPointerDown={(e) => onPointerDown(e, item)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              className={cn(
                'absolute inset-x-0 top-0 flex touch-none items-center gap-2 rounded-control pr-1.5 pl-0.5 select-none',
                dragging
                  ? 'z-10 cursor-grabbing bg-fill-hover'
                  : 'cursor-grab transition-transform duration-250 ease-slide hover:bg-fill'
              )}
              style={{ height: ROW, transform: `translateY(${y}px)` }}
            >
              <button
                ref={index === 0 ? firstGrip : undefined}
                type="button"
                aria-label={`Mover ${item.label}`}
                aria-describedby={hintId}
                onKeyDown={(e) => onKeyDown(e, index)}
                className="grid size-6 shrink-0 cursor-[inherit] place-items-center rounded-chip text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-4 [&_svg]:stroke-[1.75]"
              >
                <GripVertical aria-hidden="true" />
              </button>
              <Icon
                aria-hidden="true"
                className={cn(
                  'size-4 shrink-0 stroke-[1.75] transition-colors',
                  item.hidden ? 'text-ink-faint' : 'text-ink-soft'
                )}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px] transition-colors',
                  item.hidden ? 'text-ink-faint' : 'text-ink'
                )}
              >
                {item.label}
              </span>
              <Switch
                checked={!item.hidden}
                disabled={!item.hidden && shown === 1}
                onCheckedChange={(on) => setShown(item, on)}
                aria-label={`Mostrar ${item.label}`}
              />
            </li>
          )
        })}
      </ul>
      <p role="status" className="sr-only">
        {status}
      </p>
      {!isDefaultSidebar(prefs) && (
        <button
          type="button"
          onClick={() => {
            flushSync(() => saveSidebarItems(DEFAULT_SIDEBAR_ITEMS))
            firstGrip.current?.focus()
          }}
          className={cn(optionClass, 'mt-2 w-full animate-fade-in text-ink-soft')}
        >
          <RotateCcw className="size-4 stroke-[1.75]" aria-hidden="true" />
          Restaurar o padrão
        </button>
      )}
    </>
  )
}

export function SidebarEditor(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const byPointer = useRef(false)
  const content = useRef<HTMLDivElement>(null)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={LABEL}
          title={LABEL}
          onPointerDown={() => {
            byPointer.current = true
          }}
          onKeyDown={() => {
            byPointer.current = false
          }}
          className={cn(
            navItemClass,
            'mt-1.5 w-10 justify-center px-0',
            open && 'bg-fill-hover text-ink hover:bg-fill-hover'
          )}
        >
          <Ellipsis aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          side="right"
          align="start"
          sideOffset={6}
          alignOffset={-3}
          collisionPadding={12}
          aria-label={LABEL}
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            if (!byPointer.current) return
            e.preventDefault()
            content.current?.focus()
          }}
          className={cn(
            popupClass,
            'z-[60] w-64 origin-(--radix-popover-content-transform-origin) outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in'
          )}
        >
          <ItemsEditor />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
