import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useComputador } from '@renderer/lib/finance'
import { horaDe } from '@renderer/lib/confirmacoes'
import { useToast } from '@renderer/lib/toast'
import { COLAR_NO_WHATSAPP } from '@renderer/lib/whatsapp'

export type Via = 'whatsapp' | 'copiar'

export function useEnviarConfirmacao() {
  const computador = useComputador()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ appointmentId, via }: { appointmentId: number; via: Via }) => {
      const envio = await window.api.confirmacoes.enviar(appointmentId, computador)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      if (via === 'copiar') {
        await navigator.clipboard.writeText(envio.mensagem)
        return { envio, aberto: null }
      }
      return { envio, aberto: await window.api.terms.openWhatsApp(envio.numero, envio.mensagem) }
    },
    onSuccess: ({ envio, aberto }) => {
      const prazo = `Prazo até as ${horaDe(envio.prazo)}.`
      toast(
        aberto === null
          ? { title: 'Mensagem copiada', description: prazo }
          : {
              title: 'Confira o WhatsApp e toque em enviar',
              description: aberto === 'pronta' ? prazo : `${COLAR_NO_WHATSAPP} ${prazo}`
            }
      )
    }
  })
}
