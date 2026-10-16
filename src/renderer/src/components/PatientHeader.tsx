import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatAge } from '@shared/dates'
import { Avatar } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'

/**
 * A coluna das partes do paciente (ficha, anamnese, sessões). Igual nas três, para o nome e as abas
 * não mudarem de lugar ao trocar de parte.
 */
export const PATIENT_COLUMN = 'mx-auto max-w-[840px] px-8 pt-6 pb-16'

type PatientHeaderProps = {
  nome: string
  /** AAAA-MM-DD; vira o selo de idade. */
  nascimento: string
  inativo?: boolean
  /** Sem nome ainda (paciente novo). */
  placeholder?: string
  /** Texto ao lado dos selos (ex.: a dica do paciente novo). */
  children?: ReactNode
  /** As abas embaixo do nome; o paciente novo ainda não tem. */
  tabs?: { patientId: number; value: PatientTab }
}

/**
 * Monograma, nome grande, selos (idade, inativo) e as abas: o topo da ficha, da anamnese e das
 * sessões.
 */
export function PatientHeader({
  nome,
  nascimento,
  inativo,
  placeholder = '',
  children,
  tabs
}: PatientHeaderProps): React.JSX.Element {
  const idade = formatAge(nascimento)
  return (
    <header className={tabs ? 'mb-8' : 'mb-6'}>
      <div className="flex items-center gap-4">
        <Avatar name={nome} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[26px] leading-tight font-semibold tracking-tight">
            {nome || placeholder}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {idade && <Badge className="tabular-nums">{idade}</Badge>}
            {inativo && <Badge className="animate-pop-in">Inativo</Badge>}
            {children}
          </div>
        </div>
      </div>
      {tabs && <PatientTabs {...tabs} />}
    </header>
  )
}

export type PatientTab = 'ficha' | 'anamnese' | 'sessoes'

const TABS: [PatientTab, string][] = [
  ['ficha', 'Ficha'],
  ['anamnese', 'Anamnese'],
  ['sessoes', 'Sessões']
]

const TAB_PATH: Record<PatientTab, string> = {
  ficha: '',
  anamnese: '/anamnese',
  sessoes: '/sessoes'
}

/**
 * As partes do paciente, logo embaixo do nome e sempre no mesmo lugar (no cabeçalho da página elas
 * andavam junto com os botões de cada parte). São links: cada parte tem endereço próprio. O que foi
 * digitado e não salvo fica guardado ao trocar de parte (ver `useDraft`).
 */
function PatientTabs({
  patientId,
  value
}: {
  patientId: number
  value: PatientTab
}): React.JSX.Element {
  return (
    <nav aria-label="Partes do paciente" className="mt-5 flex gap-1">
      {TABS.map(([tab, label]) => (
        <Link
          key={tab}
          to={`/pacientes/${patientId}${TAB_PATH[tab]}`}
          aria-current={tab === value ? 'page' : undefined}
          className={cn(
            'flex h-8 items-center rounded-control px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-fill hover:text-ink pointer-coarse:h-10',
            // ativa: o mesmo fundo do item ativo do menu lateral
            tab === value && 'bg-fill-hover text-ink hover:bg-fill-hover'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
