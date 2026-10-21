import { useQuery } from '@tanstack/react-query'
import { Cake } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { aniversariantes, idadeQueCompleta } from '@shared/aniversarios'
import type { Patient } from '@shared/schemas'
import { Button } from '@renderer/components/ui/button'
import { optionClass, popupClass } from '@renderer/components/ui/field-style'
import { patientsQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

const nascimentos = (patients: Patient[]): Map<number, string> =>
  new Map(patients.map((p) => [p.id, p.data_nascimento]))

function useHoje(): Date {
  const [hoje, setHoje] = useState(() => new Date())
  useEffect(() => {
    const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)
    const timer = setTimeout(() => setHoje(new Date()), amanha.getTime() - Date.now() + 1000)
    return () => clearTimeout(timer)
  }, [hoje])
  return hoje
}

const anos = (idade: number): string => `${idade} ${idade === 1 ? 'ano' : 'anos'}`

export function AniversariantesHoje(): React.JSX.Element | null {
  const hoje = useHoje()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data } = useQuery(patientsQuery(false))
  const lista = useMemo(() => aniversariantes(data ?? [], hoje), [data, hoje])
  if (lista.length === 0) return null
  const nomes = lista.map((p) => p.nome).join(', ')
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Aniversariantes de hoje"
          title={`Aniversário hoje: ${nomes}`}
        >
          <Cake />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Aniversariantes de hoje"
          className={cn(
            popupClass,
            'z-[60] w-64 origin-(--radix-popover-content-transform-origin) focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in'
          )}
        >
          <ul>
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(optionClass, 'w-full justify-between focus-visible:bg-fill-hover')}
                  onClick={() => {
                    setOpen(false)
                    void navigate(`/pacientes/${p.id}`)
                  }}
                >
                  <span className="min-w-0 truncate">{p.nome}</span>
                  <span className="shrink-0 text-xs text-ink-soft tabular-nums">
                    {anos(p.idade)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function BoloAniversario({
  patientId,
  dia
}: {
  patientId: number
  dia: Date
}): React.JSX.Element | null {
  const { data } = useQuery({ ...patientsQuery(false), select: nascimentos })
  const idade = idadeQueCompleta(data?.get(patientId) ?? '', dia)
  if (idade === null) return null
  return (
    <Cake
      role="img"
      aria-label={`Faz ${anos(idade)} neste dia`}
      className="mr-1 inline size-3 -translate-y-px stroke-[2] opacity-75"
    />
  )
}
