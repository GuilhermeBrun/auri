import AppIntents
import Foundation

struct AbrirNovaSessao: AppIntent {
  static let title: LocalizedStringResource = "Nova sessão"
  static let description = IntentDescription("Abre o Auri para marcar uma sessão.")
  static let openAppWhenRun = true

  static let chave = "abrir-nova-sessao"

  func perform() async throws -> some IntentResult {
    UserDefaults(suiteName: Resumo.grupo)?.set(true, forKey: Self.chave)
    return .result()
  }

  static func pedida() -> Bool {
    let compartilhado = UserDefaults(suiteName: Resumo.grupo)
    guard compartilhado?.bool(forKey: chave) == true else { return false }
    compartilhado?.removeObject(forKey: chave)
    return true
  }
}
