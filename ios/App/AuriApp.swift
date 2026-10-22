import SwiftUI

@main
struct AuriApp: App {
  @State private var conexao = Conexao()
  @State private var avisos = Avisos()
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
          PrincipalView(conexao: conexao, avisos: avisos)
        }
      }
      .onAppear {
        conexao.aoAvisar = { avisos.publicar($0) }
        conexao.iniciar()
      }
    }
    .onChange(of: fase) { _, nova in
      switch nova {
      case .background: conexao.suspender()
      case .active:
        conexao.retomar()
        Task { await avisos.atualizar() }
      default: break
      }
    }
  }
}
