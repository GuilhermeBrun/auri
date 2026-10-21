import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { BackupSection } from '@renderer/components/backup/BackupSection'
import { ConnectionSection } from '@renderer/components/connection/ConnectionSection'
import { Page } from '@renderer/components/Layout'
import { Callout } from '@renderer/components/ui/callout'
import { useBackup } from '@renderer/lib/backup'
import { useConnection } from '@renderer/lib/connection'
import { useReception } from '@renderer/lib/reception'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'

export function StoragePage(): React.JSX.Element {
  const [params] = useSearchParams()
  const section = params.get('secao')
  const { info } = useConnection()
  const backup = useBackup()
  const reception = useReception()
  const ready = info !== null && backup !== null
  useEffect(() => {
    if (section && ready) document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section, ready])
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Armazenamento' }]}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-14 px-8 pt-8 pb-16">
        {reception && (
          <Callout title="Só para ver">
            Este é o computador da recepção. A conexão e a cópia de segurança mudam depois de
            desligar a chave em Configurações / Geral.
          </Callout>
        )}
        <fieldset disabled={reception} className="contents">
          <ConnectionSection />
          <BackupSection />
        </fieldset>
      </div>
    </Page>
  )
}
