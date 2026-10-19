import { useMutation } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { FileDown } from 'lucide-react'
import { useId, useState } from 'react'
import { isIsoDate, parseIsoDate, toIsoDate } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import { DateField } from '@renderer/components/ui/date-field'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { useToast } from '@renderer/lib/toast'

type Range = { de: string; ate: string }

function monthRange(date: Date): Range {
  return { de: toIsoDate(startOfMonth(date)), ate: toIsoDate(endOfMonth(date)) }
}

function monthLabel(date: Date): string {
  const text = format(date, "MMMM 'de' yyyy", { locale: ptBR })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function useSavePdf(patientId: number, onSaved?: () => void) {
  const toast = useToast()
  return useMutation({
    mutationFn: ({ de, ate }: Range) => window.api.attendance.reportPdf(patientId, de, ate),
    onSuccess: (file) => {
      if (file) toast({ title: 'Relatório salvo', description: file.split(/[\\/]/).at(-1) })
      onSaved?.()
    }
  })
}

export function MonthReportButton({
  patientId,
  month
}: {
  patientId: number
  month: Date
}): React.JSX.Element {
  const toast = useToast()
  const report = useSavePdf(patientId)
  const label = `Relatório de presença de ${monthLabel(month).toLowerCase()}`
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      loading={report.isPending}
      onClick={() =>
        report.mutate(monthRange(month), {
          onError: (error) =>
            toast({ title: 'Não foi possível gerar o relatório', description: error.message })
        })
      }
    >
      <FileDown />
    </Button>
  )
}

const PERIODOS = [
  ['atual', 'Este mês'],
  ['anterior', 'Mês passado'],
  ['outro', 'Outro período']
] as const

type Periodo = (typeof PERIODOS)[number][0]

export function AttendanceReportDialog({
  patientId,
  open,
  onOpenChange
}: {
  patientId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório de presença"
      description="Sessões do período, com a assinatura de chegada de cada uma, em PDF."
    >
      {open && <ReportForm patientId={patientId} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function ReportForm({
  patientId,
  onClose
}: {
  patientId: number
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const [now] = useState(() => new Date())
  const [periodo, setPeriodo] = useState<Periodo>('atual')
  const [custom, setCustom] = useState<Range>(() => monthRange(now))
  const report = useSavePdf(patientId, onClose)

  const range =
    periodo === 'atual'
      ? monthRange(now)
      : periodo === 'anterior'
        ? monthRange(subMonths(now, 1))
        : custom
  const valid = isIsoDate(range.de) && isIsoDate(range.ate) && range.ate >= range.de

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) report.mutate(range)
      }}
    >
      <DialogBody className="flex flex-col gap-4">
        <div className="self-start">
          <Segmented label="Período" value={periodo} options={PERIODOS} onChange={setPeriodo} />
        </div>
        {periodo === 'outro' ? (
          <div className="grid grid-cols-2 gap-3 animate-fade-in">
            <Field label="De" htmlFor={`${ids}-de`}>
              <DateField
                id={`${ids}-de`}
                value={custom.de}
                onChange={(de) => setCustom((c) => ({ ...c, de }))}
                invalid={!isIsoDate(custom.de)}
              />
            </Field>
            <Field label="Até" htmlFor={`${ids}-ate`}>
              <DateField
                id={`${ids}-ate`}
                value={custom.ate}
                onChange={(ate) => setCustom((c) => ({ ...c, ate }))}
                invalid={!isIsoDate(custom.ate) || custom.ate < custom.de}
              />
            </Field>
          </div>
        ) : (
          <p className="text-[13px] text-ink-soft">{monthLabel(parseIsoDate(range.de))}</p>
        )}
        {report.error && <ErrorText>{report.error.message}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        <span />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid} loading={report.isPending}>
            <FileDown /> Gerar PDF
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
