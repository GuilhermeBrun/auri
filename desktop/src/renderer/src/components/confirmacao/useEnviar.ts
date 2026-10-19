import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useComputador } from '@renderer/lib/finance'
import { horaDe } from '@renderer/lib/confirmacoes'
import { useToast } from '@renderer/lib/toast'

export type Via = 'whatsapp' | 'copiar'

export function useEnviarConfirmacao() {
  const computador = useComputador()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ appointmentId, via }: { appointmentId: number; via: Via }) => {
      const envio = await window.api.confirmacoes.enviar(appointmentId, computador)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      if (via === 'whatsapp') await window.api.terms.openWhatsApp(envio.numero, envio.mensagem)
      else await navigator.clipboard.writeText(envio.mensagem)
      return { envio, via }
    },
    onSuccess: ({ envio, via }) => {
      const prazo = `O prazo para responder vai até as ${horaDe(envio.prazo)}.`
      toast(
        via === 'whatsapp'
          ? { title: 'Confira o WhatsApp e toque em enviar', description: prazo }
          : { title: 'Mensagem copiada', description: `Cole na conversa do WhatsApp. ${prazo}` }
      )
    }
  })
}
