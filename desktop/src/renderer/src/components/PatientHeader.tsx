import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatAge } from '@shared/dates'
import { Avatar } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { WaitlistButton } from '@renderer/components/waitlist/WaitlistButton'
import { useReception } from '@renderer/lib/reception'
import { PATIENT_TABS, type PatientTab } from '@renderer/lib/session'
import { cn } from '@renderer/lib/utils'

export const PATIENT_COLUMN = 'mx-auto max-w-[840px] px-8 pt-6 pb-16'

type PatientHeaderProps = {
  nome: string
  nascimento: string
  inativo?: boolean
  placeholder?: string
  children?: ReactNode
  tabs?: { patientId: number; value: PatientTab }
}

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
      {tabs && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <PatientTabs {...tabs} />
          {!inativo && <WaitlistButton patient={{ id: tabs.patientId, nome }} />}
        </div>
      )}
    </header>
  )
}

const CLINICAL_TABS: readonly PatientTab[] = ['anamnese', 'evolucoes']

const TAB_PATH: Record<PatientTab, string> = {
  ficha: '',
  anamnese: '/anamnese',
  sessoes: '/sessoes',
  evolucoes: '/evolucoes',
  termos: '/termos',
  financeiro: '/financeiro'
}

function PatientTabs({
  patientId,
  value
}: {
  patientId: number
  value: PatientTab
}): React.JSX.Element {
  const reception = useReception()
  const tabs = reception
    ? PATIENT_TABS.filter(([tab]) => !CLINICAL_TABS.includes(tab))
    : PATIENT_TABS
  return (
    <nav aria-label="Partes do paciente" className="flex gap-1">
      {tabs.map(([tab, label]) => (
        <Link
          key={tab}
          to={`/pacientes/${patientId}${TAB_PATH[tab]}`}
          aria-current={tab === value ? 'page' : undefined}
          className={cn(
            'flex h-8 items-center rounded-control px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-fill hover:text-ink pointer-coarse:h-10',
            tab === value && 'bg-fill-hover text-ink hover:bg-fill-hover'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
