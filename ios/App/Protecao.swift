import SwiftUI
import UIKit

@MainActor
final class Protecao {
  enum Estado: Equatable {
    case nenhuma
    case capa
    case bloqueio
  }

  private var janela: UIWindow?
  private var atual = Estado.nenhuma

  func aplicar(_ estado: Estado, bloqueio: Bloqueio) {
    guard estado != atual else { return }
    atual = estado
    switch estado {
    case .nenhuma:
      janela?.isHidden = true
      janela = nil
    case .capa:
      mostrar(CapaDePrivacidade())
    case .bloqueio:
      mostrar(TelaDeBloqueio(bloqueio: bloqueio))
    }
  }

  private func mostrar(_ conteudo: some View) {
    guard
      let cena = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState != .unattached })
    else { return }
    let janela = self.janela ?? UIWindow(windowScene: cena)
    janela.windowLevel = .alert + 1
    janela.rootViewController = UIHostingController(rootView: conteudo)
    janela.isHidden = false
    self.janela = janela
  }
}
