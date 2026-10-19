import type { TipoAtendimento } from '@shared/tipos'
import { CorPonto } from '@renderer/components/ui/cor'
import { Select } from '@renderer/components/ui/select'

export function TipoSelect({
  id,
  value,
  onChange,
  tipos,
  invalid,
  compact
}: {
  id?: string
  value: number | undefined
  onChange: (tipo: TipoAtendimento) => void
  tipos: TipoAtendimento[]
  invalid?: boolean
  compact?: boolean
}): React.JSX.Element {
  return (
    <Select
      id={id}
      value={value === undefined ? '' : String(value)}
      onValueChange={(v) => {
        const tipo = tipos.find((t) => String(t.id) === v)
        if (tipo) onChange(tipo)
      }}
      options={tipos.map((t) => ({
        value: String(t.id),
        label: t.nome,
        icon: <CorPonto cor={t.cor} />
      }))}
      invalid={invalid}
      compact={compact}
    />
  )
}
