import SwiftUI

struct PrincipalView: View {
  let conexao: Conexao

  @State private var agenda: Agenda
  @State private var cadastro: Cadastro
  @State private var novaSessao: NovaSessao?

  init(conexao: Conexao) {
    self.conexao = conexao
    _agenda = State(initialValue: Agenda(conexao: conexao))
    _cadastro = State(initialValue: Cadastro(conexao: conexao))
  }

  var body: some View {
    TabView {
      Tab("Agenda", systemImage: "calendar") {
        AgendaView(conexao: conexao, agenda: agenda, cadastro: cadastro)
      }
      Tab("Pacientes", systemImage: "person.crop.circle") {
        NavigationStack {
          PacientesView(conexao: conexao, cadastro: cadastro) { novaSessao = NovaSessao(paciente: $0) }
        }
      }
      Tab("Conexão", systemImage: "desktopcomputer") {
        NavigationStack {
          ConexaoView(conexao: conexao)
        }
      }
    }
    .sheet(item: $novaSessao) { nova in
      NovaSessaoView(agenda: agenda, cadastro: cadastro, nova: nova)
    }
    .task(id: [conexao.conectado ? 1 : 0, conexao.mudancas]) {
      guard conexao.conectado else { return }
      await cadastro.carregar()
    }
  }
}
