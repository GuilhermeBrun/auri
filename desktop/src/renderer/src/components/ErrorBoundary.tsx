import { Component, type ReactNode } from 'react'
import { ErrorState } from '@renderer/components/ui/error'

type State = { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <ErrorState title="Esta tela não abriu" onRetry={() => this.setState({ failed: false })}>
        Os dados salvos continuam guardados. Tente de novo ou vá para outra tela.
      </ErrorState>
    )
  }
}
