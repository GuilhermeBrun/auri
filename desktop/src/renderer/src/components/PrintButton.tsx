import { useMutation } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useToast } from '@renderer/lib/toast'

export function PrintButton({
  label,
  blocked,
  print
}: {
  label: string
  blocked?: string
  print: () => Promise<void>
}): React.JSX.Element {
  const toast = useToast()
  const pdf = useMutation({
    mutationFn: print,
    onError: (error) => toast({ title: 'Não foi possível gerar o PDF', description: error.message })
  })
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => pdf.mutate()}
      disabled={Boolean(blocked)}
      loading={pdf.isPending}
      aria-label={label}
      title={blocked ?? label}
    >
      <Printer />
    </Button>
  )
}
