import { Download } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useToast } from '@renderer/lib/toast'
import { useUpdates } from '@renderer/lib/updates'

/**
 * A versão nova terminou de baixar: avisa uma vez, com o atalho para reiniciar já. Sem clicar,
 * ela entra na próxima vez que o Auri for fechado.
 */
export function UpdateReady(): null {
  const state = useUpdates()
  const toast = useToast()
  const shown = useRef(false)
  const next = state?.status === 'ready' ? state.next : null
  useEffect(() => {
    if (!next || shown.current) return
    shown.current = true
    toast({
      title: `Versão ${next} pronta`,
      description: 'Entra quando o Auri reiniciar.',
      icon: <Download />,
      action: {
        label: 'Reiniciar',
        altText: 'Em Configurações › Atualizações, use Reiniciar e atualizar.',
        onClick: () => void window.updates.install()
      }
    })
  }, [next, toast])
  return null
}
