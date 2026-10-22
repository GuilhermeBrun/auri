import SwiftUI

@main
struct AuriApp: App {
  @State private var conexao = Conexao()
  @Environment(\.scenePhase) private var fase

  var body: some Scene {
    WindowGroup {
      ProvaView(conexao: conexao)
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
