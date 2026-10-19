import { useMutation } from '@tanstack/react-query'
import { Check, Copy, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import { Sensitive } from '@renderer/components/ui/sensitive'
import { cn } from '@renderer/lib/utils'

export function RecoveryCode({
  code,
  className
}: {
  code: string
  className?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const print = useMutation({ mutationFn: () => window.backup.printRecoveryCode(code) })

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
  }

  return (
    <div className={cn('rounded-card bg-fill p-5', className)}>
      <Sensitive
        label="Código de recuperação"
        what="o código"
        className="font-mono text-xl font-semibold tracking-[0.08em]"
      >
        {code}
      </Sensitive>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? <Check className="animate-fade-in" /> : <Copy />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button variant="secondary" loading={print.isPending} onClick={() => print.mutate()}>
          <Printer /> Imprimir
        </Button>
      </div>
      {print.error && <ErrorText>{print.error.message}</ErrorText>}
    </div>
  )
}
