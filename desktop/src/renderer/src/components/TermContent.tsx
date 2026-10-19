import { useMemo } from 'react'
import { cn } from '@renderer/lib/utils'
import { lerConteudo, type Trecho } from '../../../../../web/contrato/assinatura/conteudo'

function Trechos({ lista }: { lista: Trecho[] }): React.JSX.Element {
  return (
    <>
      {lista.map(({ texto, negrito }, i) => {
        const linhas = texto
          .split('\n')
          .flatMap((linha, j) => (j ? [<br key={j} />, linha] : [linha]))
        return negrito ? (
          <strong key={i} className="font-semibold">
            {linhas}
          </strong>
        ) : (
          <span key={i}>{linhas}</span>
        )
      })}
    </>
  )
}

export function TermContent({
  texto,
  className
}: {
  texto: string
  className?: string
}): React.JSX.Element {
  const blocos = useMemo(() => lerConteudo(texto), [texto])
  return (
    <div className={cn('flex flex-col gap-2.5 text-[13px] leading-relaxed', className)}>
      {blocos.map((bloco, i) => {
        if (bloco.tipo === 'titulo')
          return bloco.nivel === 1 ? (
            <h3 key={i} className="mt-2 text-[17px] font-semibold tracking-tight first:mt-0">
              <Trechos lista={bloco.trechos} />
            </h3>
          ) : (
            <h4 key={i} className="mt-2 text-[14px] font-semibold first:mt-0">
              <Trechos lista={bloco.trechos} />
            </h4>
          )
        if (bloco.tipo === 'lista')
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {bloco.itens.map((item, j) => (
                <li key={j}>
                  <Trechos lista={item} />
                </li>
              ))}
            </ul>
          )
        return (
          <p key={i}>
            <Trechos lista={bloco.trechos} />
          </p>
        )
      })}
    </div>
  )
}
