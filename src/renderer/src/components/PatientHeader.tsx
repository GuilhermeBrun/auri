import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { formatAge } from '@shared/dates'
import { Avatar } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { Segmented } from '@renderer/components/ui/segmented'

type PatientHeaderProps = {
  nome: string
  /** AAAA-MM-DD; vira o selo de idade. */
  nascimento: string
  inativo?: boolean
  /** Sem nome ainda (paciente novo). */
  placeholder?: string
  /** Texto ao lado dos selos (ex.: a dica do paciente novo). */
  children?: ReactNode
}

/** Monograma, nome grande e selos (idade, inativo): o topo da ficha, da anamnese e das sessões. */
export function PatientHeader({
  nome,
  nascimento,
  inativo,
  placeholder = '',
  children
}: PatientHeaderProps): React.JSX.Element {
  const idade = formatAge(nascimento)
  return (
    <header className="mb-6 flex items-center gap-4">
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
 * As partes do paciente, no cabeçalho da página como a visão da agenda. O que foi digitado e não
 * salvo fica guardado ao trocar de parte (ver `useDraft`).
 */
export function PatientTabs({
  patientId,
  value
}: {
  patientId: number
  value: PatientTab
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <Segmented
      label="Partes do paciente"
      value={value}
      options={TABS}
      onChange={(tab) => void navigate(`/pacientes/${patientId}${TAB_PATH[tab]}`)}
    />
  )
}
