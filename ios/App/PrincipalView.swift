import SwiftUI

struct PrincipalView: View {
  let conexao: Conexao

  @State private var vendoConexao = false

  var body: some View {
    TabView {
      Tab("Agenda", systemImage: "calendar") {
        NavigationStack {
          ContentUnavailableView(
            "Agenda em construção",
            systemImage: "calendar",
            description: Text("A agenda chega na próxima versão do app.")
          )
          .navigationTitle("Agenda")
          .toolbar { botaoDaConexao }
        }
      }
      Tab("Pacientes", systemImage: "person.2") {
        NavigationStack {
          PacientesView(conexao: conexao)
            .navigationTitle("Pacientes")
            .toolbar { botaoDaConexao }
        }
      }
    }
    .sheet(isPresented: $vendoConexao) {
      ConexaoView(conexao: conexao)
    }
  }

  private var botaoDaConexao: some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
      Button {
        vendoConexao = true
      } label: {
        Image(
          systemName: conexao.conectado
            ? "desktopcomputer" : "desktopcomputer.trianglebadge.exclamationmark"
        )
      }
      .accessibilityLabel("Conexão: \(conexao.descricao)")
    }
  }
}
