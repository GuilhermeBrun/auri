import SwiftUI

@main
struct AuriApp: App {
  @State private var conexao = Conexao()
  @Environment(\.scenePhase) private var fase

  init() {
    UIDatePicker.appearance().minuteInterval = 5
  }

  var body: some Scene {
    WindowGroup {
      Group {
        if conexao.servidor == nil {
          BoasVindasView(conexao: conexao)
        } else {
          PrincipalView(conexao: conexao)
        }
      }
      .onAppear { conexao.iniciar() }
    }
    .onChange(of: fase) { _, nova in
      switch nova {
      case .background: conexao.suspender()
      case .active: conexao.retomar()
      default: break
      }
    }
  }
}
