import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Controller, useForm, type Control } from 'react-hook-form'
import { logoDataUrl } from '@shared/clinic'
import { formatPhone } from '@shared/masks'
import { clinicInputSchema, type Clinic, type ClinicInput } from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { PageSection, SettingsGroup } from '@renderer/components/ui/section'
import { clinicQuery } from '@renderer/lib/queries'
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
    <PageSection id={id} title={title} description={description}>
      <SettingsGroup className="grid grid-cols-2 gap-x-3 gap-y-4">{children}</SettingsGroup>
    </PageSection>
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
        <div className="flex h-16 w-44 shrink-0 items-center justify-center rounded-control bg-surface p-2">
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
              <ImagePlus /> {value ? 'Trocar logo' : 'Escolher logo'}
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
          </div>
        </div>
      </Page>
    </form>
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
