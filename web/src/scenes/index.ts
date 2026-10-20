import {
  AgendaScene,
  AnamneseScene,
  ArrivalScene,
  BackupScene,
  ConfirmationScene,
  ConnectionScene,
  FinanceScene,
  TermsScene,
  WaitlistScene
} from './scenes'

export const SCENES = {
  agenda: AgendaScene,
  confirmacao: ConfirmationScene,
  encaixe: WaitlistScene,
  anamnese: AnamneseScene,
  sessoes: ArrivalScene,
  termos: TermsScene,
  financeiro: FinanceScene,
  copia: BackupScene,
  conexao: ConnectionScene
}
