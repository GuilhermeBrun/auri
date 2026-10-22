import SwiftUI

struct PrincipalView: View {
  let conexao: Conexao
  let avisos: Avisos

  @State private var aba = Aba.agenda
  @State private var agenda: Agenda
  @State private var cadastro: Cadastro
  @State private var novaSessao: NovaSessao?

  enum Aba: Hashable {
    case agenda
    case pacientes
    case conexao
  }

  init(conexao: Conexao, avisos: Avisos) {
    self.conexao = conexao
    self.avisos = avisos
    _agenda = State(initialValue: Agenda(conexao: conexao))
    _cadastro = State(initialValue: Cadastro(conexao: conexao))
  }

  var body: some View {
    TabView(selection: $aba) {
      Tab("Agenda", image: "agenda", value: Aba.agenda) {
        AgendaView(conexao: conexao, agenda: agenda, cadastro: cadastro, avisos: avisos)
      }
      Tab("Pacientes", image: "pacientes", value: Aba.pacientes) {
        NavigationStack {
          PacientesView(conexao: conexao, cadastro: cadastro) { novaSessao = NovaSessao(paciente: $0) }
        }
      }
      Tab("Conexão", image: "conexao", value: Aba.conexao) {
        NavigationStack {
          ConexaoView(conexao: conexao, avisos: avisos)
        }
      }
    }
    .onChange(of: avisos.destino) { _, destino in
      if destino != nil { aba = .agenda }
    }
    .task { await avisos.pedirSeNecessario() }
    .sheet(item: $novaSessao) { nova in
      NovaSessaoView(agenda: agenda, cadastro: cadastro, nova: nova)
    }
    .task(id: [conexao.conectado ? 1 : 0, conexao.mudancas]) {
      guard conexao.conectado else { return }
      await cadastro.carregar()
    }
  }
}
