import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Send } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatPhone, isValidPhone } from '@shared/masks'
import {
  contatoPrincipal,
  isAdult,
  pessoasDaFicha,
  responsavelDe,
  type Pessoa
} from '@shared/responsavel'
import { TERM_PRAZOS, type Patient, type TermModel, type TermSendInput } from '@shared/schemas'
import { mensagemDaIda } from '@shared/terms'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ChoiceButton } from '@renderer/components/ui/choice-button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { Segmented } from '@renderer/components/ui/segmented'
import { useConnection } from '@renderer/lib/connection'
import { clinicQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

const OUTRA = 'outra'

const PRAZOS = TERM_PRAZOS.map((d) => [String(d), `${d} dias`] as const)

export function SendTerm({
  patient,
  model,
  onClose
}: {
  patient: Patient
  model: TermModel | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog
      open={model !== null}
      onOpenChange={(open) => !open && onClose()}
      title={model ? `Enviar "${model.titulo}"` : 'Enviar termo'}
      description="Vai pelo WhatsApp. A pessoa lê e assina no celular, e a resposta volta pelo mesmo caminho."
    >
      {model && <SendForm patient={patient} model={model} onClose={onClose} />}
    </Dialog>
  )
}

function SendForm({
  patient,
  model,
  onClose
}: {
  patient: Patient
  model: TermModel
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { info } = useConnection()
  const clinic = useQuery(clinicQuery())
  const pessoas = pessoasDaFicha(patient).filter(
    (p) => p.papel !== 'paciente' || isAdult(patient.data_nascimento)
  )
  const contato = contatoPrincipal(patient)
  const padrao = pessoas.some((p) => p.papel === contato?.papel)
    ? contato
    : responsavelDe(patient).pessoa
  const [escolha, setEscolha] = useState<string>(padrao?.papel ?? pessoas[0]?.papel ?? OUTRA)
  const pessoa: Pessoa | null = pessoas.find((p) => p.papel === escolha) ?? null
  const [celulares, setCelulares] = useState<Record<string, string>>(() =>
    Object.fromEntries(pessoas.map((p) => [p.papel, p.celular]))
  )
  const [outra, setOutra] = useState({ nome: '', parentesco: '', celular: '' })
  const [dias, setDias] = useState('7')

  const celular = pessoa ? (celulares[pessoa.papel] ?? '') : outra.celular
  const destino: TermSendInput['destino'] = pessoa
    ? {
        papel: pessoa.papel,
        nome: pessoa.nome,
        parentesco: pessoa.parentesco,
        cpf: pessoa.cpf,
        celular
      }
    : {
        papel: 'outro',
        nome: outra.nome.trim(),
        parentesco: outra.parentesco.trim(),
        cpf: '',
        celular
      }
  const pronto = destino.nome !== '' && destino.parentesco !== '' && isValidPhone(celular)

  const missing = clinic.data
    ? [
        !clinic.data.nome && 'o nome da clínica',
        !clinic.data.whatsapp && 'o WhatsApp',
        !clinic.data.profissional && 'o profissional responsável'
      ].filter(Boolean)
    : []

  const send = useMutation({
    mutationFn: async (via: 'whatsapp' | 'copiar') => {
      const sent = await window.api.terms.send(
        patient.id,
        { model_id: model.id, destino, dias: Number(dias) },
        info?.name || 'Este computador'
      )
      void queryClient.invalidateQueries({ queryKey: ['terms'] })
      if (via === 'whatsapp') await window.api.terms.openWhatsApp(sent.numero, sent.mensagem)
      else await navigator.clipboard.writeText(sent.mensagem)
      return via
    },
    onSuccess: (via) => {
      toast(
        via === 'whatsapp'
          ? { title: 'Termo enviado', description: 'Confira o WhatsApp e toque em enviar.' }
          : { title: 'Mensagem copiada', description: 'Cole na conversa do WhatsApp.' }
      )
      onClose()
    }
  })

  return (
    <>
      <DialogBody className="flex flex-col gap-5">
        {missing.length > 0 && (
          <Callout tone="warning" title="Faltam dados da clínica">
            Preencha {missing.join(', ')} na tela Clínica.{' '}
            <button
              type="button"
              className="font-medium text-ink underline underline-offset-2"
              onClick={() => void navigate('/clinica')}
            >
              Abrir a Clínica
            </button>
          </Callout>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium">Para quem</legend>
          <div className="flex flex-wrap gap-2">
            {pessoas.map((p) => (
              <ChoiceButton
                key={p.papel}
                pressed={escolha === p.papel}
                onClick={() => setEscolha(p.papel)}
              >
                <span className="font-medium">{p.nome.split(' ')[0]}</span>
                <span className="text-ink-soft">{p.parentesco}</span>
              </ChoiceButton>
            ))}
            <ChoiceButton pressed={escolha === OUTRA} onClick={() => setEscolha(OUTRA)}>
              <span className="font-medium">Outra pessoa</span>
            </ChoiceButton>
          </div>
        </fieldset>

        {pessoa ? (
          <Field label={`Celular de ${pessoa.nome.split(' ')[0]}`} htmlFor={`${ids}-cel`}>
            <Input
              id={`${ids}-cel`}
              value={celular}
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              onChange={(e) =>
                setCelulares((c) => ({ ...c, [pessoa.papel]: formatPhone(e.target.value) }))
              }
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" htmlFor={`${ids}-nome`} className="col-span-2">
              <Input
                id={`${ids}-nome`}
                value={outra.nome}
                onChange={(e) => setOutra((o) => ({ ...o, nome: e.target.value }))}
              />
            </Field>
            <Field label="Parentesco" htmlFor={`${ids}-par`}>
              <Input
                id={`${ids}-par`}
                value={outra.parentesco}
                placeholder="Avó, tia…"
                onChange={(e) => setOutra((o) => ({ ...o, parentesco: e.target.value }))}
              />
            </Field>
            <Field label="Celular" htmlFor={`${ids}-ocel`}>
              <Input
                id={`${ids}-ocel`}
                value={outra.celular}
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                onChange={(e) => setOutra((o) => ({ ...o, celular: formatPhone(e.target.value) }))}
              />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium">Vale por</span>
          <Segmented label="Prazo" value={dias} options={PRAZOS} onChange={setDias} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">Mensagem</span>
          <p className="rounded-control bg-fill px-3 py-2 text-[13px] whitespace-pre-line text-ink-soft">
            {mensagemDaIda({
              destino: destino.nome || 'tudo bem',
              titulo: model.titulo,
              paciente: patient.nome.split(' ')[0],
              clinica: clinic.data?.nome || 'clínica',
              link: 'https://auri.dev.br/assinar#…'
            })}
          </p>
        </div>
        {send.error && <p className="text-xs text-danger">{send.error.message}</p>}
      </DialogBody>
      <DialogFooter>
        <span />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!pronto || missing.length > 0}
            loading={send.isPending && send.variables === 'copiar'}
            onClick={() => send.mutate('copiar')}
          >
            <Copy /> Copiar mensagem
          </Button>
          <Button
            disabled={!pronto || missing.length > 0}
            loading={send.isPending && send.variables === 'whatsapp'}
            onClick={() => send.mutate('whatsapp')}
          >
            <Send /> Abrir no WhatsApp
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
