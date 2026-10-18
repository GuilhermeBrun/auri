import { useMutation } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { Page } from '@renderer/components/Layout'
import { SettingsImport } from '@renderer/components/SettingsImport'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, SectionTitle } from '@renderer/components/ui/section'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { useToast } from '@renderer/lib/toast'

/**
 * Configurações → Importar e exportar: as configurações deste computador num arquivo próprio
 * (`.auriconfig`), sem senha e sem dados. Os pacientes e a agenda ficam na Cópia de segurança.
 */
export function TransferPage(): React.JSX.Element {
  const toast = useToast()
  const exportFile = useMutation({
    mutationFn: () => window.transfer.exportSettings(),
    onSuccess: (file) => {
      if (file) {
        toast({ title: 'Configurações exportadas', description: file.split(/[\\/]/).pop() })
      }
    }
  })
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Importar e exportar' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <p className="text-[13px] text-ink-soft">
          As configurações deste computador num arquivo, para levar a outro. Os pacientes e a agenda
          não vão junto: para eles, use a Cópia de segurança.
        </p>

        <section className="mt-8">
          <SectionTitle title="Exportar configurações">
            Aparência, as opções da Conexão e as escolhas da cópia de segurança. Não vão senhas,
            chaves nem a lista de computadores conectados.
          </SectionTitle>
          <Button
            variant="secondary"
            className="mt-3"
            loading={exportFile.isPending}
            onClick={() => exportFile.mutate()}
          >
            {!exportFile.isPending && <FileUp />} Exportar configurações…
          </Button>
          {exportFile.error && <ErrorText>{exportFile.error.message}</ErrorText>}
        </section>

        <section className="mt-10">
          <SectionTitle title="Importar configurações">
            De um arquivo exportado por outro Auri. Antes de aplicar, aparece o que vai mudar. Para
            conectar ao consultório, o pareamento é feito de novo em Conexão.
          </SectionTitle>
          <div className="mt-3">
            <SettingsImport />
          </div>
        </section>
      </div>
    </Page>
  )
}
