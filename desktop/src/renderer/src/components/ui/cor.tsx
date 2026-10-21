import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { COR_HEX, CORES_PRONTAS, type Cor } from '@shared/tipos'
import { Input } from '@renderer/components/ui/input'
import { CONTORNO, RodaDeCor } from '@renderer/components/ui/roda-de-cor'
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

function CorPropria({
  value,
  onChange
}: {
  value: string
  onChange: (cor: string) => void
}): React.JSX.Element {
  const [texto, setTexto] = useState(value)
  const [visto, setVisto] = useState(value)
  if (value !== visto) {
    setVisto(value)
    setTexto(value)
  }
  return (
    <div className="animate-fade-in rounded-card bg-fill p-4">
      <RodaDeCor value={value} onChange={onChange}>
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
      </RodaDeCor>
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
