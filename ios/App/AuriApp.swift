import SwiftUI

@main
struct AuriApp: App {
  @State private var conexao = Conexao()
  @State private var avisos = Avisos()
  @State private var bloqueio = Bloqueio()
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
          PrincipalView(conexao: conexao, avisos: avisos, bloqueio: bloqueio)
        }
      }
      .overlay {
        if conexao.servidor != nil {
          if bloqueio.bloqueado {
            TelaDeBloqueio(bloqueio: bloqueio)
          } else if fase != .active {
            CapaDePrivacidade()
          }
        }
      }
      .onAppear {
        conexao.aoAvisar = { avisos.publicar($0) }
        conexao.iniciar()
        if conexao.servidor != nil { bloqueio.abrir() }
      }
    }
    .onChange(of: fase) { _, nova in
      switch nova {
      case .background:
        conexao.suspender()
        bloqueio.saiu()
      case .active:
        conexao.retomar()
        bloqueio.voltou()
        Task { await avisos.atualizar() }
      default: break
      }
    }
  }
}
