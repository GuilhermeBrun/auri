import type { ReactNode } from 'react'

function Icone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className ? `icone ${className}` : 'icone'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function Enviar() {
  return (
    <Icone>
      <path d="M14.5 21.7a.5.5 0 0 0 .9 0l6.6-19a.5.5 0 0 0-.7-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z" />
      <path d="m21.9 2.1-11 11" />
    </Icone>
  )
}

export function Desfazer() {
  return (
    <Icone>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icone>
  )
}

export function Limpar() {
  return (
    <Icone>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </Icone>
  )
}

export function Copiar() {
  return (
    <Icone>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
    </Icone>
  )
}

export function Alerta() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icone>
  )
}

export function Relogio() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icone>
  )
}

export function LinkQuebrado() {
  return (
    <Icone>
      <path d="M9 17H7A5 5 0 0 1 7 7" />
      <path d="M15 7h2a5 5 0 0 1 4 8" />
      <path d="M8 12h4" />
      <path d="m2 2 20 20" />
    </Icone>
  )
}

export function Atualizar() {
  return (
    <Icone>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Icone>
  )
}

export function Conversa() {
  return (
    <Icone>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Icone>
  )
}

export function Cadeado() {
  return (
    <Icone>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icone>
  )
}

export function Computador() {
  return (
    <Icone>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </Icone>
  )
}

export function Carregando() {
  return (
    <Icone className="girando">
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </Icone>
  )
}

export function Confirmar() {
  return (
    <Icone>
      <path d="M20 6 9 17l-5-5" />
    </Icone>
  )
}

export function Desmarcar() {
  return (
    <Icone>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m14 14-4 4" />
      <path d="m10 14 4 4" />
    </Icone>
  )
}

export function Voltar() {
  return (
    <Icone>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icone>
  )
}
