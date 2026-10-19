import type { ReactNode } from 'react'
import { Wordmark } from '../components/icons'
import { Cadeado } from './icones'

type PropsDoAviso = {
  icone: ReactNode
  titulo: string
  children?: ReactNode
  acao?: ReactNode
}

export function Aviso({ icone, titulo, children, acao }: PropsDoAviso) {
  return (
    <section className="aviso">
      <span className="aviso-icone">{icone}</span>
      <h1>{titulo}</h1>
      {children}
      {acao && <div className="aviso-acoes">{acao}</div>}
    </section>
  )
}

export function Rodape({ children }: { children: ReactNode }) {
  return (
    <footer className="rodape">
      <p>
        <Cadeado />
        {children}
      </p>
      <Wordmark />
    </footer>
  )
}
