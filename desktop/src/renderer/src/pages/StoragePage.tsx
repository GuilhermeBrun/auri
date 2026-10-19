import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { BackupSection } from '@renderer/components/backup/BackupSection'
import { ConnectionSection } from '@renderer/components/connection/ConnectionSection'
import { Page } from '@renderer/components/Layout'
import { useBackup } from '@renderer/lib/backup'
import { useConnection } from '@renderer/lib/connection'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'

export function StoragePage(): React.JSX.Element {
  const [params] = useSearchParams()
  const section = params.get('secao')
  const { info } = useConnection()
  const backup = useBackup()
  const ready = info !== null && backup !== null
  useEffect(() => {
    if (section && ready) document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section, ready])
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Armazenamento' }]}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-14 px-8 pt-8 pb-16">
        <ConnectionSection />
        <BackupSection />
      </div>
    </Page>
  )
}
