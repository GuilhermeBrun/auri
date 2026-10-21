import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ClipboardPaste, Copy, FileSignature, FileText, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { TermModel, TermRequest } from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { patientTrail } from '@renderer/lib/session'
import { SendTerm } from '@renderer/components/SendTerm'
import { Button } from '@renderer/components/ui/button'
import { ConfirmAction } from '@renderer/components/ui/confirm-action'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Loading } from '@renderer/components/ui/loading'
import { patientQuery, patientTermsQuery, termModelsQuery } from '@renderer/lib/queries'
import { openReceive, signedLocal } from '@renderer/lib/terms'
import { useReception } from '@renderer/lib/reception'
import { useToast } from '@renderer/lib/toast'
import { abrirOuCopiar, COLAR_NO_WHATSAPP } from '@renderer/lib/whatsapp'
import { cn } from '@renderer/lib/utils'

export function PatientTermsRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientTermsPage key={patientId} patientId={patientId} />
}

const day = (iso: string): string => format(new Date(iso), 'dd/MM')

type Linha = {
  model: TermModel
  atual: TermRequest | null
  anteriores: TermRequest[]
}

function linhas(models: TermModel[], requests: TermRequest[]): Linha[] {
  return models
    .map((model) => {
      const doModelo = requests.filter((r) => r.model_id === model.id)
      const aguardando = doModelo.find((r) => r.estado === 'aguardando')
      const assinados = doModelo.filter((r) => r.estado === 'assinado')
      const atual = aguardando ?? assinados[0] ?? doModelo[0] ?? null
      return {
        model,
        atual,
        anteriores: assinados.filter((r) => r !== atual)
      }
    })
    .filter((l) => !l.model.arquivado || l.atual !== null)
}

function PatientTermsPage({ patientId }: { patientId: number }): React.JSX.Element {
  const navigate = useNavigate()
  const patient = useQuery(patientQuery(patientId))
  const models = useQuery(termModelsQuery())
  const requests = useQuery(patientTermsQuery(patientId))
  const [sending, setSending] = useState<TermModel | null>(null)
  const reception = useReception()
  const error = patient.error ?? models.error ?? requests.error
  const rows = useMemo(
    () => (models.data && requests.data ? linhas(models.data, requests.data) : null),
    [models.data, requests.data]
  )

  return (
    <Page
      trail={patientTrail(patientId, patient.data?.nome, 'termos')}
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openReceive()}
          aria-label="Colar resposta"
          title="Colar resposta"
        >
          <ClipboardPaste />
        </Button>
      }
    >
      <div className={PATIENT_COLUMN}>
        {patient.data && (
          <PatientHeader
            nome={patient.data.nome}
            nascimento={patient.data.data_nascimento}
            inativo={!patient.data.ativo}
            tabs={{ patientId, value: 'termos' }}
          />
        )}
        {error ? (
          <ErrorState
            title="Não foi possível abrir os termos"
            detail={error.message}
            onRetry={() => {
              void patient.refetch()
              void models.refetch()
              void requests.refetch()
            }}
          >
            Tente de novo. Se o problema continuar, feche e abra o Auri.
          </ErrorState>
        ) : !patient.data || !rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileSignature />}
            title="Nenhum modelo de termo"
            action={
              !reception && (
                <Button variant="secondary" onClick={() => void navigate('/clinica/termos/novo')}>
                  Criar modelo
                </Button>
              )
            }
          >
            {reception
              ? 'Os modelos são criados no computador do consultório.'
              : 'Os modelos ficam na tela Clínica.'}
          </EmptyState>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {rows.map((row) => (
              <li key={row.model.id}>
                <TermRow row={row} onSend={() => setSending(row.model)} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {patient.data && (
        <SendTerm patient={patient.data} model={sending} onClose={() => setSending(null)} />
      )}
    </Page>
  )
}

function estado(r: TermRequest | null): { texto: string; tom: 'ink' | 'soft' | 'faint' } {
  if (!r) return { texto: 'Ainda não enviado', tom: 'faint' }
  const quem = `${r.destino_nome.split(' ')[0]} (${r.destino_parentesco.toLowerCase()})`
  switch (r.estado) {
    case 'aguardando':
      return {
        texto: `Enviado para ${quem} em ${day(r.created_at)} · vence em ${day(r.prazo)}`,
        tom: 'soft'
      }
    case 'assinado': {
      const s = r.assinado!
      const quando = format(signedLocal(s.assinado_em, s.fuso_minutos), 'dd/MM/yyyy')
      const versao =
        r.versao < r.versao_atual ? ` · versão ${r.versao} (atual: ${r.versao_atual})` : ''
      return {
        texto: `Assinado por ${s.nome} (${s.parentesco.toLowerCase()}) em ${quando}${versao}`,
        tom: 'ink'
      }
    }
    case 'vencido':
      return { texto: `O link venceu em ${day(r.prazo)}, sem resposta`, tom: 'faint' }
    case 'cancelado':
      return { texto: `Envio cancelado em ${day(r.estado_em ?? r.created_at)}`, tom: 'faint' }
    default:
      return { texto: 'Ainda não enviado', tom: 'faint' }
  }
}

function TermRow({ row, onSend }: { row: Linha; onSend: () => void }): React.JSX.Element {
  const toast = useToast()
  const { model, atual, anteriores } = row
  const { texto, tom } = estado(atual)
  const resend = useMutation({
    mutationFn: async (via: 'whatsapp' | 'copiar') => {
      const link = await window.api.terms.link(atual!.id)
      return abrirOuCopiar(via, link.numero, link.mensagem)
    },
    onSuccess: (aberto) => {
      if (aberto === null) toast({ title: 'Mensagem copiada' })
      if (aberto === 'copiada')
        toast({ title: 'Confira o WhatsApp', description: COLAR_NO_WHATSAPP })
    }
  })
  const cancel = useMutation({ mutationFn: () => window.api.terms.cancel(atual!.id) })
  const pdf = useMutation({ mutationFn: (id: number) => window.api.terms.openPdf(id) })
  const failure = resend.error ?? cancel.error ?? pdf.error

  return (
    <div className="flex flex-col gap-2 rounded-card px-3 py-3 transition-colors hover:bg-fill/50">
      <div className="flex items-center gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-fill text-ink-soft [&_svg]:size-4">
          <FileSignature aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium">
            {model.titulo}
            {model.arquivado && <span className="ml-2 text-xs text-ink-faint">arquivado</span>}
          </span>
          <span
            className={cn(
              'truncate text-xs',
              tom === 'ink' ? 'text-ink' : tom === 'soft' ? 'text-ink-soft' : 'text-ink-faint'
            )}
          >
            {texto}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {atual?.estado === 'aguardando' ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copiar mensagem"
                title="Copiar mensagem"
                onClick={() => resend.mutate('copiar')}
              >
                <Copy />
              </Button>
              <ConfirmAction
                question="Cancelar o envio?"
                confirmLabel="Cancelar envio"
                cancelLabel="Voltar"
                loading={cancel.isPending}
                onConfirm={() => cancel.mutate()}
              >
                Cancelar
              </ConfirmAction>
              <Button variant="ghost" size="sm" onClick={() => openReceive()}>
                Colar resposta
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={resend.isPending && resend.variables === 'whatsapp'}
                onClick={() => resend.mutate('whatsapp')}
              >
                <Send /> Reenviar
              </Button>
            </>
          ) : atual?.estado === 'assinado' ? (
            <>
              {!model.arquivado && (
                <Button variant="ghost" size="sm" onClick={onSend}>
                  Enviar de novo
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                loading={pdf.isPending && pdf.variables === atual.assinado!.id}
                onClick={() => pdf.mutate(atual.assinado!.id)}
              >
                <FileText /> Abrir PDF
              </Button>
            </>
          ) : (
            !model.arquivado && (
              <Button variant="secondary" size="sm" onClick={onSend}>
                <Send /> Enviar termo
              </Button>
            )
          )}
        </div>
      </div>
      {anteriores.length > 0 && (
        <ul className="ml-13 flex flex-col gap-1">
          {anteriores.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 text-xs text-ink-soft"
            >
              <span>
                Substituído · assinado por {r.assinado!.nome} em{' '}
                {format(
                  signedLocal(r.assinado!.assinado_em, r.assinado!.fuso_minutos),
                  'dd/MM/yyyy'
                )}{' '}
                · versão {r.versao}
              </span>
              <Button
                variant="ghost"
                size="sm"
                loading={pdf.isPending && pdf.variables === r.assinado!.id}
                onClick={() => pdf.mutate(r.assinado!.id)}
              >
                <FileText /> PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
      {failure && <p className="ml-13 text-xs text-danger">{failure.message}</p>}
    </div>
  )
}
