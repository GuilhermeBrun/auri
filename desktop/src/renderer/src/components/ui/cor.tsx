import { Check, Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { COR_HEX, CORES_PRONTAS, type Cor } from '@shared/tipos'
import { Input } from '@renderer/components/ui/input'
import { hexParaHsv, hsvParaHex, type Hsv } from '@renderer/lib/cor'
import { cn } from '@renderer/lib/utils'

export function CorPonto({ cor, className }: { cor: Cor; className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: cor }}
      className={cn('size-2 shrink-0 rounded-full', className)}
    />
  )
}

const limitar = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

const PASSO = (e: KeyboardEvent): number => (e.shiftKey ? 10 : 1)

const DISCO = 136

const MATIZES = `conic-gradient(${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% 50%)`).join(', ')})`

const CONTORNO = 'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-ink)_12%,transparent)]'

const FOCO =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const POLEGAR =
  'pointer-events-none absolute size-4 -translate-1/2 rounded-full shadow-[0_0_0_2px_#fff,0_1px_4px_rgb(0_0_0/0.35)]'

function arrastar(mover: (e: PointerEvent<HTMLDivElement>) => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      mover(e)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e)
    }
  }
}

function useHsv(value: string, onChange: (cor: string) => void): [Hsv, (next: Hsv) => void] {
  const [hsv, setHsv] = useState(() => hexParaHsv(value))
  const [origem, setOrigem] = useState(value)
  if (value !== origem) {
    setOrigem(value)
    if (hsvParaHex(hsv) !== value) setHsv(hexParaHsv(value))
  }
  return [
    hsv,
    (next) => {
      setHsv(next)
      const hex = hsvParaHex(next)
      setOrigem(hex)
      onChange(hex)
    }
  ]
}

function Disco({ hsv, mudar }: { hsv: Hsv; mudar: (next: Hsv) => void }): React.JSX.Element {
  const raio = DISCO / 2
  const peloDisco = (e: PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    mudar({
      ...hsv,
      h: Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360),
      s: Math.round(limitar(Math.hypot(dx, dy) / (r.width / 2), 0, 1) * 100)
    })
  }
  const tecla = (e: KeyboardEvent): void => {
    const p = PASSO(e)
    if (e.key === 'ArrowRight') mudar({ ...hsv, h: (hsv.h + p) % 360 })
    else if (e.key === 'ArrowLeft') mudar({ ...hsv, h: (hsv.h - p + 360) % 360 })
    else if (e.key === 'ArrowUp') mudar({ ...hsv, s: limitar(hsv.s + p, 0, 100) })
    else if (e.key === 'ArrowDown') mudar({ ...hsv, s: limitar(hsv.s - p, 0, 100) })
    else if (e.key === 'Home') mudar({ ...hsv, h: 0 })
    else if (e.key === 'End') mudar({ ...hsv, h: 359 })
    else return
    e.preventDefault()
  }
  const angulo = (hsv.h * Math.PI) / 180
  const distancia = (hsv.s / 100) * raio
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Matiz"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={hsv.h}
      aria-valuetext={`Matiz ${hsv.h} graus, saturação ${hsv.s}%`}
      onKeyDown={tecla}
      {...arrastar(peloDisco)}
      className={cn('relative shrink-0 touch-none rounded-full', FOCO)}
      style={{ width: DISCO, height: DISCO }}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-0 rounded-full', CONTORNO)}
        style={{
          background: `radial-gradient(circle closest-side, #fff, rgb(255 255 255 / 0)), ${MATIZES}`
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-black"
        style={{ opacity: 1 - hsv.v / 100 }}
      />
      <span
        aria-hidden="true"
        className={POLEGAR}
        style={{
          left: raio + Math.sin(angulo) * distancia,
          top: raio - Math.cos(angulo) * distancia,
          backgroundColor: hsvParaHex(hsv)
        }}
      />
    </div>
  )
}

function Brilho({
  hsv,
  mudar,
  rotulo
}: {
  hsv: Hsv
  mudar: (next: Hsv) => void
  rotulo: string
}): React.JSX.Element {
  const pelaBarra = (e: PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    mudar({ ...hsv, v: Math.round(limitar((e.clientX - r.left) / r.width, 0, 1) * 100) })
  }
  const tecla = (e: KeyboardEvent): void => {
    const p = PASSO(e)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
      mudar({ ...hsv, v: limitar(hsv.v + p, 0, 100) })
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      mudar({ ...hsv, v: limitar(hsv.v - p, 0, 100) })
    else if (e.key === 'Home') mudar({ ...hsv, v: 0 })
    else if (e.key === 'End') mudar({ ...hsv, v: 100 })
    else return
    e.preventDefault()
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-labelledby={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hsv.v}
      aria-valuetext={`${hsv.v}%`}
      onKeyDown={tecla}
      {...arrastar(pelaBarra)}
      className={cn('relative h-3 w-full touch-none rounded-full', CONTORNO, FOCO)}
      style={{
        background: `linear-gradient(to right, #000, ${hsvParaHex({ ...hsv, v: 100 })})`
      }}
    >
      <span
        aria-hidden="true"
        className={cn(POLEGAR, 'top-1/2')}
        style={{ left: `${hsv.v}%`, backgroundColor: hsvParaHex(hsv) }}
      />
    </div>
  )
}

function CorPropria({
  value,
  onChange
}: {
  value: string
  onChange: (cor: string) => void
}): React.JSX.Element {
  const ids = useId()
  const [hsv, mudar] = useHsv(value, onChange)
  const [texto, setTexto] = useState(value)
  const [visto, setVisto] = useState(value)
  if (value !== visto) {
    setVisto(value)
    setTexto(value)
  }
  return (
    <div className="flex animate-fade-in items-center gap-6 rounded-card bg-fill p-4">
      <Disco hsv={hsv} mudar={mudar} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn('size-8 shrink-0 rounded-control', CONTORNO)}
            style={{ backgroundColor: value }}
          />
          <Input
            aria-label="Código da cor"
            value={texto.toUpperCase()}
            spellCheck={false}
            maxLength={7}
            onChange={(e) => {
              const digitado = e.target.value.trim()
              const hex = digitado.startsWith('#') ? digitado : `#${digitado}`
              setTexto(e.target.value)
              if (COR_HEX.test(hex.toLowerCase())) onChange(hex.toLowerCase())
            }}
            onBlur={() => setTexto(value)}
            className="h-8 w-[104px] font-mono text-[13px] tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span id={`${ids}-brilho`} className="text-xs font-medium text-ink-soft">
            Brilho
          </span>
          <Brilho hsv={hsv} mudar={mudar} rotulo={`${ids}-brilho`} />
        </div>
      </div>
    </div>
  )
}

const ALVO =
  'grid size-7 place-items-center rounded-full transition-[box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const ESCOLHIDA = 'shadow-[0_0_0_2px_var(--color-raised),0_0_0_4px_var(--color-ink)]'

function Amostra({
  cor,
  nome,
  escolhida,
  onClick
}: {
  cor: string
  nome: string
  escolhida: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={escolhida}
      aria-label={nome}
      title={nome}
      onClick={onClick}
      className={cn(ALVO, escolhida && ESCOLHIDA)}
    >
      <span
        className={cn('grid size-6 place-items-center rounded-full', CONTORNO)}
        style={{ backgroundColor: cor }}
      >
        {escolhida && (
          <Check className="size-3.5 stroke-[2.5] text-white drop-shadow-sm" aria-hidden />
        )}
      </span>
    </button>
  )
}

export function CorEscolha({
  value,
  onChange,
  label
}: {
  value: Cor
  onChange: (cor: Cor) => void
  label: string
}): React.JSX.Element {
  const pronta = CORES_PRONTAS.some((c) => c.cor === value)
  const [aberta, setAberta] = useState(!pronta)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        <div role="radiogroup" aria-label={label} className="contents">
          {CORES_PRONTAS.map(({ cor, nome }) => (
            <Amostra
              key={cor}
              cor={cor}
              nome={nome}
              escolhida={value === cor}
              onClick={() => onChange(cor)}
            />
          ))}
          {!pronta && (
            <Amostra
              cor={value}
              nome={value.toUpperCase()}
              escolhida
              onClick={() => setAberta(true)}
            />
          )}
        </div>
        <button
          type="button"
          aria-expanded={aberta}
          aria-label="Outra cor"
          title="Outra cor"
          onClick={() => setAberta((a) => !a)}
          className={ALVO}
        >
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full bg-fill text-ink-soft transition-colors hover:bg-fill-hover hover:text-ink',
              aberta && 'bg-fill-hover text-ink'
            )}
          >
            <Plus
              className={cn('size-3.5 stroke-[2.25] transition-transform', aberta && 'rotate-45')}
              aria-hidden
            />
          </span>
        </button>
      </div>
      {aberta && <CorPropria value={value} onChange={onChange} />}
    </div>
  )
}
