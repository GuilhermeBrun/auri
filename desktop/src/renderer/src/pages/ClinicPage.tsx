import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronRight, FileSignature, ImagePlus, Plus } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Controller, useForm, type Control } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { logoDataUrl } from '@shared/clinic'
import { formatPhone } from '@shared/masks'
import { clinicInputSchema, type Clinic, type ClinicInput } from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { clinicQuery, termModelsQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

const TRAIL = [{ label: 'Clínica' }]

function toInput({ updated_at: _, ...input }: Clinic): Required<ClinicInput> {
  return input
}

function Group({
  id,
  title,
  description,
  children
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="text-[15px] font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-ink-soft">{description}</p>
      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4">{children}</div>
    </section>
  )
}

function PhoneInput({
  control,
  name
}: {
  control: Control<Required<ClinicInput>>
  name: 'telefone' | 'whatsapp'
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          onChange={(e) => field.onChange(formatPhone(e.target.value))}
          inputMode="numeric"
          placeholder="(00) 00000-0000"
          aria-invalid={fieldState.invalid}
        />
      )}
    />
  )
}

function LogoField({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const choose = useMutation({
    mutationFn: () => window.api.clinic.chooseLogo(),
    onSuccess: (logo) => {
      if (logo !== null) onChange(logo)
    }
  })
  return (
    <div className="col-span-2 flex flex-col gap-1">
      <span className="text-xs font-medium">Logo</span>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-44 shrink-0 items-center justify-center rounded-control bg-fill p-2">
          {value ? (
            <img
              src={logoDataUrl(value)}
              alt="Logo da clínica"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-ink-faint">Sem logo</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <div className="flex gap-1">
            <Button variant="secondary" loading={choose.isPending} onClick={() => choose.mutate()}>
              {!choose.isPending && <ImagePlus />} {value ? 'Trocar logo' : 'Escolher logo'}
            </Button>
            {value && (
              <Button variant="ghost" onClick={() => onChange('')}>
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-soft">
            {choose.error ? (
              <span className="text-danger">{choose.error.message}</span>
            ) : (
              'PNG ou JPG. Fundo transparente fica melhor.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function ClinicForm({ clinic }: { clinic: Clinic }): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<Required<ClinicInput>>({
    resolver: zodResolver(clinicInputSchema),
    defaultValues: toInput(clinic)
  })

  useEffect(() => reset(toInput(clinic)), [clinic, reset])

  const save = useMutation({
    mutationFn: (input: ClinicInput) => window.api.clinic.save(input, clinic.updated_at),
    onSuccess: (saved) => {
      queryClient.setQueryData(['clinic'], saved)
      toast({ title: 'Dados da clínica salvos', description: saved.nome || undefined })
    }
  })

  const err = (field: keyof ClinicInput): string | undefined => errors[field]?.message
  const invalid = (field: keyof ClinicInput): boolean => Boolean(errors[field])

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="h-full">
      <Page
        trail={TRAIL}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Salvar alterações
          </Button>
        }
      >
        <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
          {save.error && (
            <Callout tone="danger" title="Não foi possível salvar" className="mb-6">
              {save.error.message}
            </Callout>
          )}

          <p className="text-[13px] text-ink-soft">
            Como a clínica aparece nos documentos que o Auri gera.
          </p>
          <div className="mt-8 flex flex-col gap-14">
            <Group
              id="documentos"
              title="Nos documentos"
              description="O logo e o nome vão no cabeçalho do relatório de presença e dos termos."
            >
              <Controller
                control={control}
                name="logo"
                render={({ field }) => <LogoField value={field.value} onChange={field.onChange} />}
              />
              <Field label="Nome da clínica" error={err('nome')} className="col-span-2">
                <Input {...register('nome')} aria-invalid={invalid('nome')} />
              </Field>
              <Field label="CNPJ ou CPF" error={err('documento')}>
                <Input {...register('documento')} aria-invalid={invalid('documento')} />
              </Field>
              <Field label="Telefone" error={err('telefone')}>
                <PhoneInput control={control} name="telefone" />
              </Field>
              <Field label="Endereço" error={err('endereco')} className="col-span-2">
                <Input {...register('endereco')} aria-invalid={invalid('endereco')} />
              </Field>
            </Group>

            <Group
              id="profissional"
              title="Profissional responsável"
              description="Aparece nos relatórios, ao lado dos dados do paciente."
            >
              <Field label="Nome" error={err('profissional')}>
                <Input {...register('profissional')} aria-invalid={invalid('profissional')} />
              </Field>
              <Field label="Registro" hint="CRFa, CRP…" error={err('registro')}>
                <Input {...register('registro')} aria-invalid={invalid('registro')} />
              </Field>
            </Group>

            <Group
              id="termos"
              title="Termos assinados pelo celular"
              description="O responsável envia o termo assinado para este WhatsApp."
            >
              <Field label="WhatsApp da clínica" error={err('whatsapp')}>
                <PhoneInput control={control} name="whatsapp" />
              </Field>
            </Group>
            <TermModels />
          </div>
        </div>
      </Page>
    </form>
  )
}

function TermModels(): React.JSX.Element {
  const navigate = useNavigate()
  const models = useQuery(termModelsQuery())
  const list = [...(models.data ?? [])].sort((a, b) => Number(a.arquivado) - Number(b.arquivado))
  return (
    <section aria-labelledby="modelos-titulo">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="modelos-titulo" className="text-[15px] font-semibold tracking-tight">
            Modelos de termo
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Os termos que a clínica envia para a família ler e assinar pelo celular.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void navigate('/clinica/termos/novo')}>
          <Plus /> Novo modelo
        </Button>
      </div>
      {models.error && <p className="mt-4 text-xs text-danger">{models.error.message}</p>}
      {models.data && list.length === 0 && (
        <p className="mt-6 text-[13px] text-ink-faint">
          Nenhum modelo ainda. O texto é da clínica: o Auri só leva até a família e guarda o que
          voltar assinado.
        </p>
      )}
      {list.length > 0 && (
        <ul className="-mx-3 mt-4 flex flex-col">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => void navigate(`/clinica/termos/${m.id}`)}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <FileSignature
                  className={m.arquivado ? 'size-4 text-ink-faint' : 'size-4 text-ink-soft'}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      m.arquivado
                        ? 'truncate text-[13px] text-ink-soft'
                        : 'truncate text-[13px] font-medium'
                    }
                  >
                    {m.titulo}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {m.arquivado ? 'Arquivado · ' : ''}Versão {m.versao} · atualizado em{' '}
                    {format(new Date(m.atualizado_em), 'dd/MM/yyyy')}
                  </span>
                </span>
                <ChevronRight className="size-4 text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ClinicPage(): React.JSX.Element {
  const clinic = useQuery(clinicQuery())
  if (clinic.data) return <ClinicForm clinic={clinic.data} />
  return (
    <Page trail={TRAIL}>
      {clinic.error ? (
        <ErrorState
          title="Não foi possível abrir os dados da clínica"
          detail={clinic.error.message}
          onRetry={() => void clinic.refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : (
        <Loading />
      )}
    </Page>
  )
}
